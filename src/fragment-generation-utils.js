/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fragments from './text-fragment-utils.js';

const MAX_EXACT_MATCH_LENGTH = 300;
const ITERATIONS_BEFORE_ADDING_CONTEXT = 3;

/**
 * Enum indicating the success, or failure reason, of generateFragment.
 */
export const GenerateFragmentStatus = {
  SUCCESS: 0,            // A fragment was generated.
  INVALID_SELECTION: 1,  // The selection provided could not be used.
  AMBIGUOUS: 2  // No unique fragment could be identified for this selection.
}

/**
 * @typedef {Object} GenerateFragmentResult
 * @property {GenerateFragmentStatus} status
 * @property {TextFragment} [fragment]
 */

/**
 * Attempts to generate a fragment, suitable for formatting and including in a
 * URL, which will highlight the given selection upon opening.
 * @param {Selection} selection - a Selection object, the result of
 *     window.getSelection
 * @return {GenerateFragmentResult}
 */
export const generateFragment = (selection) => {
  let range;
  try {
    range = selection.getRangeAt(0);
  } catch {
    return {status: GenerateFragmentStatus.INVALID_SELECTION};
  }

  expandRangeStartToWordBound(range);
  expandRangeEndToWordBound(range);

  let factory;

  // First, try the easy case of just using the range text as the fragment.
  const exactText = fragments.internal.normalizeString(range.toString());
  if (canUseExactMatch(range)) {
    const fragment = {
      textStart: exactText,
    };
    if (isUniquelyIdentifying(fragment)) {
      return {
        status: GenerateFragmentStatus.SUCCESS,
        fragment: fragment,
      };
    }
  }

  if (canUseExactMatch(range)) {
    factory = new FragmentFactory().setExactTextMatch(exactText);
  } else {
    // We have to use textStart and textEnd to identify a range. First, break
    // the range up based on block boundaries, as textStart/textEnd can't cross
    // these.
    const startSearchSpace = getSearchSpaceForStart(range);
    const endSearchSpace = getSearchSpaceForEnd(range);

    if (startSearchSpace && endSearchSpace) {
      // If the search spaces are truthy, then there's a block boundary between
      // them.
      factory = new FragmentFactory().setStartAndEndSearchSpace(
          startSearchSpace, endSearchSpace);
    } else {
      // If the search space was empty/undefined, it's because no block boundary
      // was found. That means textStart and textEnd *share* a search space, so
      // our approach must ensure the substrings chosen as candidates don't
      // overlap.
      factory = new FragmentFactory().setSharedSearchSpace(
          trimBoundary(range.toString()));
    }
  }

  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(document.body);
  const suffixRange = prefixRange.cloneRange();

  prefixRange.setEnd(range.startContainer, range.startOffset);
  suffixRange.setStart(range.endContainer, range.endOffset);

  const prefixSearchSpace = getSearchSpaceForEnd(prefixRange);
  const suffixSearchSpace = getSearchSpaceForStart(suffixRange);

  if (prefixSearchSpace && suffixSearchSpace) {
    factory.setPrefixAndSuffixSearchSpace(prefixSearchSpace, suffixSearchSpace);
  }

  while (factory.embiggen()) {
    const fragment = factory.tryToMakeUniqueFragment();
    if (fragment != null) {
      return {
        status: GenerateFragmentStatus.SUCCESS,
        fragment: fragment,
      };
    }
  }
  return {status: GenerateFragmentStatus.AMBIGUOUS};
};

/**
 * Finds the search space for parameters when using range or suffix match.
 * This is the text from the start of the range to the first block boundary,
 * trimmed to remove any leading/trailing boundary characters.
 * @param {Range} range - the range which will be highlighted.
 * @return {String|Undefined} - the text which may be used for constructing a
 *     textStart parameter identifying this range. Will return undefined if no
 *     block boundaries are found inside this range, or if all the candidate
 *     ranges were empty (or included only boundary characters).
 */
const getSearchSpaceForStart = (range) => {
  let node = getFirstNodeForBlockSearch(range);
  const walker = makeWalkerForNode(node, range.endContainer);
  const map = createForwardOverrideMap(walker);
  const origin = node;

  // tempRange monitors whether we've exhausted our search space yet.
  const tempRange = range.cloneRange();
  while (!tempRange.collapsed && node != null) {
    // Depending on whether |node| is an ancestor of the start of our
    // search, we use either its leading or trailing edge as our start.
    if (node.contains(origin)) {
      tempRange.setStartAfter(node);
    } else {
      tempRange.setStartBefore(node);
    }

    // If |node| is a block node, then we've hit a block boundary.
    if (isBlock(node)) {
      const candidate = range.cloneRange();
      candidate.setEnd(tempRange.startContainer, tempRange.startOffset);
      const trimmed = trimBoundary(candidate.toString());
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    node = forwardTraverse(walker, map);
  }
  return undefined;
};

/**
 * Finds the search space for parameters when using range or prefix match.
 * This is the text from the last block boundary to the end of the range,
 * trimmed to remove any leading/trailing boundary characters.
 * @param {Range} range - the range which will be highlighted.
 * @return {String|Undefined} - the text which may be used for constructing a
 *     textEnd parameter identifying this range. Will return undefined if no
 *     block boundaries are found inside this range, or if all the candidate
 *     ranges were empty (or included only boundary characters).
 */
const getSearchSpaceForEnd = (range) => {
  let node = getLastNodeForBlockSearch(range);
  const walker = makeWalkerForNode(node, range.startContainer);
  const visited = new Set();
  const origin = node;

  // tempRange monitors whether we've exhausted our search space yet.
  const tempRange = range.cloneRange();
  while (!tempRange.collapsed && node != null) {
    // Depending on whether |node| is an ancestor of the start of our
    // search, we use either its leading or trailing edge as our end.
    if (node.contains(origin)) {
      tempRange.setEnd(node, 0);
    } else {
      tempRange.setEndAfter(node);
    }

    // If |node| is a block node, then we've hit a block boundary.
    if (isBlock(node)) {
      const candidate = range.cloneRange();
      candidate.setStart(tempRange.endContainer, tempRange.endOffset);
      const trimmed = trimBoundary(candidate.toString());
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    node = backwardTraverse(walker, visited, origin);
  }
  return undefined;
};

/**
 * Helper class for constructing range-based fragments for selections that cross
 * block boundaries.
 */
const FragmentFactory = class {
  /**
   * Initializes the basic state of the factory. Users should then call exactly
   * one of setStartAndEndSearchSpace, setSharedSearchSpace, or
   * setExactTextMatch, and optionally setPrefixAndSuffixSearchSpace.
   */
  constructor() {
    this.Mode = {
      ALL_PARTS: 1,
      SHARED_START_AND_END: 2,
      CONTEXT_ONLY: 3,
    };

    this.startOffset = null;
    this.endOffset = null;
    this.prefixOffset = null;
    this.suffixOffset = null;

    this.prefixSearchSpace = '';
    this.backwardsPrefixSearchSpace = '';
    this.suffixSearchSpace = '';

    this.numIterations = 0;
  }

  /**
   * Generates a fragment based on the current state, then tests it for
   * uniqueness.
   * @return {TextFragment|Undefined} - a text fragment if the current state is
   *     uniquely identifying, or undefined if the current state is ambiguous.
   */
  tryToMakeUniqueFragment() {
    let fragment;
    if (this.mode === this.Mode.CONTEXT_ONLY) {
      fragment = {textStart: this.exactTextMatch};
    } else {
      fragment = {
        textStart: trimBoundary(
            this.getStartSearchSpace().substring(0, this.startOffset)),
        textEnd:
            trimBoundary(this.getEndSearchSpace().substring(this.endOffset)),
      };
    }
    if (this.prefixOffset != null) {
      const prefix = trimBoundary(
          this.getPrefixSearchSpace().substring(this.prefixOffset));
      if (prefix) {
        fragment.prefix = prefix;
      }
    }
    if (this.suffixOffset != null) {
      const suffix = trimBoundary(
          this.getSuffixSearchSpace().substring(0, this.suffixOffset));
      if (suffix) {
        fragment.suffix = suffix;
      }
    }
    return isUniquelyIdentifying(fragment) ? fragment : undefined;
  }

  /**
   * Shifts the current state such that the candidates for textStart and textEnd
   * represent more of the possible search spaces.
   * @return {boolean} - true if the desired expansion occurred; false if the
   *     entire search space has been consumed and no further attempts can be
   *     made.
   */
  embiggen() {
    let canExpandRange = true;

    if (this.mode === this.Mode.SHARED_START_AND_END) {
      if (this.startOffset >= this.endOffset) {
        // If the search space is shared between textStart and textEnd, then
        // stop expanding when textStart overlaps textEnd.
        canExpandRange = false;
      }
    } else if (this.mode === this.Mode.ALL_PARTS) {
      // Stop expanding if both start and end have already consumed their full
      // search spaces.
      if (this.startOffset === this.getStartSearchSpace().length &&
          this.backwardsEndOffset() === this.getEndSearchSpace().length) {
        canExpandRange = false;
      }
    } else if (this.mode === this.Mode.CONTEXT_ONLY) {
      canExpandRange = false;
    }

    let canExpandContext = false;
    // Context is only added when the range match space is exhausted, or after
    // a set number of iterations, whichever comes first.
    if (!canExpandRange ||
        this.numIterations >= ITERATIONS_BEFORE_ADDING_CONTEXT) {
      // Check if there's any unused search space left.
      if ((this.backwardsPrefixOffset() != null &&
           this.backwardsPrefixOffset() !==
               this.getPrefixSearchSpace().length) ||
          (this.suffixOffset != null &&
           this.suffixOffset !== this.getSuffixSearchSpace().length)) {
        canExpandContext = true;
      }
    }

    if (canExpandRange) {
      if (this.startOffset < this.getStartSearchSpace().length) {
        // Find the next boundary char.
        // TODO: should keep going if we haven't added any non boundary chars.
        const newStartOffset = this.getStartSearchSpace()
                                   .substring(this.startOffset + 1)
                                   .search(fragments.internal.BOUNDARY_CHARS);
        if (newStartOffset === -1) {
          this.startOffset = this.getStartSearchSpace().length;
        } else {
          this.startOffset = this.startOffset + 1 + newStartOffset;
        }

        // Ensure we don't have overlapping start and end segments.
        if (this.mode === this.Mode.SHARED_START_AND_END) {
          this.startOffset = Math.min(this.startOffset, this.endOffset);
        }
      }

      if (this.backwardsEndOffset() < this.getEndSearchSpace().length) {
        // Find the next boundary char.
        // TODO: should keep going if we haven't added any non boundary chars.
        const newBackwardsOffset =
            this.getBackwardsEndSearchSpace()
                .substring(this.backwardsEndOffset() + 1)
                .search(fragments.internal.BOUNDARY_CHARS);
        if (newBackwardsOffset === -1) {
          this.setBackwardsEndOffset(this.getEndSearchSpace().length);
        } else {
          this.setBackwardsEndOffset(
              this.backwardsEndOffset() + 1 + newBackwardsOffset);
        }

        // Ensure we don't have overlapping start and end segments.
        if (this.mode === this.Mode.SHARED_START_AND_END) {
          this.endOffset = Math.max(this.startOffset, this.endOffset);
        }
      }
    }

    if (canExpandContext) {
      if (this.backwardsPrefixOffset() < this.getPrefixSearchSpace().length) {
        const newBackwardsPrefixOffset =
            this.getBackwardsPrefixSearchSpace()
                .substring(this.backwardsPrefixOffset() + 1)
                .search(fragments.internal.BOUNDARY_CHARS);
        if (newBackwardsPrefixOffset === -1) {
          this.setBackwardsPrefixOffset(
              this.getBackwardsPrefixSearchSpace().length);
        } else {
          this.setBackwardsPrefixOffset(
              this.backwardsPrefixOffset() + 1 + newBackwardsPrefixOffset);
        }
      }

      if (this.suffixOffset < this.getSuffixSearchSpace().length) {
        const newSuffixOffset = this.getSuffixSearchSpace()
                                    .substring(this.suffixOffset + 1)
                                    .search(fragments.internal.BOUNDARY_CHARS);
        if (newSuffixOffset === -1) {
          this.suffixOffset = this.getSuffixSearchSpace().length;
        } else {
          this.suffixOffset = this.suffixOffset + 1 + newSuffixOffset;
        }
      }
    }

    this.numIterations++;

    // TODO: check if this exceeds the total length limit
    return canExpandRange || canExpandContext;
  }

  /**
   * Sets up the factory for a range-based match with a highlight that crosses
   * block boundaries.
   *
   * Exactly one of this, setSharedSearchSpace, or setExactTextMatch should be
   * called so the factory can identify the fragment.
   *
   * @param {String} startSearchSpace - the maximum possible string which can be
   *     used to identify the start of the fragment
   * @param {String} endSearchSpace - the maximum possible string which can be
   *     used to identify the end of the fragment
   * @return {FragmentFactory} - returns |this| to allow call chaining and
   *     assignment
   */
  setStartAndEndSearchSpace(startSearchSpace, endSearchSpace) {
    this.startSearchSpace = startSearchSpace;
    this.endSearchSpace = endSearchSpace;
    this.backwardsEndSearchSpace = reverseString(endSearchSpace);

    this.startOffset = 0;
    this.endOffset = endSearchSpace.length;

    this.mode = this.Mode.ALL_PARTS;
    return this;
  }

  /**
   * Sets up the factory for a range-based match with a highlight that doesn't
   * cross block boundaries.
   *
   * Exactly one of this, setStartAndEndSearchSpace, or setExactTextMatch should
   * be called so the factory can identify the fragment.
   *
   * @param {String} sharedSearchSpace - the full text of the highlight
   * @return {FragmentFactory} - returns |this| to allow call chaining and
   *     assignment
   */
  setSharedSearchSpace(sharedSearchSpace) {
    this.sharedSearchSpace = sharedSearchSpace;
    this.backwardsSharedSearchSpace = reverseString(sharedSearchSpace);

    this.startOffset = 0;
    this.endOffset = sharedSearchSpace.length;

    this.mode = this.Mode.SHARED_START_AND_END;
    return this;
  }

  /**
   * Sets up the factory for an exact text match.
   *
   * Exactly one of this, setStartAndEndSearchSpace, or setSharedSearchSpace
   * should be called so the factory can identify the fragment.
   *
   * @param {String} exactTextMatch - the full text of the highlight
   * @return {FragmentFactory} - returns |this| to allow call chaining and
   *     assignment
   */
  setExactTextMatch(exactTextMatch) {
    this.exactTextMatch = exactTextMatch;

    this.mode = this.Mode.CONTEXT_ONLY;
    return this;
  }

  /**
   * Sets up the factory for context-based matches.
   *
   * @param {String} prefixSearchSpace - the string to be used as the search
   *     space for prefix
   * @param {String} suffixSearchSpace - the string to be used as the search
   *     space for suffix
   * @return {FragmentFactory} - returns |this| to allow call chaining and
   *     assignment
   */
  setPrefixAndSuffixSearchSpace(prefixSearchSpace, suffixSearchSpace) {
    this.prefixSearchSpace = prefixSearchSpace;
    this.backwardsPrefixSearchSpace = reverseString(prefixSearchSpace);
    this.prefixOffset = prefixSearchSpace.length;

    this.suffixSearchSpace = suffixSearchSpace;
    this.suffixOffset = 0;

    return this;
  }

  /**
   * @return {String} - the string to be used as the search space for textStart
   */
  getStartSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ?
        this.sharedSearchSpace :
        this.startSearchSpace;
  }

  /**
   * @return {String} - the string to be used as the search space for textEnd
   */
  getEndSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ?
        this.sharedSearchSpace :
        this.endSearchSpace;
  }

  /**
   * @return {String} - the string to be used as the search space for textEnd,
   *     backwards.
   */
  getBackwardsEndSearchSpace() {
    return this.mode === this.Mode.SHARED_START_AND_END ?
        this.backwardsSharedSearchSpace :
        this.backwardsEndSearchSpace;
  }

  /**
   * @return {String} - the string to be used as the search space for prefix
   */
  getPrefixSearchSpace() {
    return this.prefixSearchSpace;
  }

  /**
   * @return {String} - the string to be used as the search space for prefix,
   *     backwards.
   */
  getBackwardsPrefixSearchSpace() {
    return this.backwardsPrefixSearchSpace;
  }

  /**
   * @return {String} - the string to be used as the search space for suffix
   */
  getSuffixSearchSpace() {
    return this.suffixSearchSpace;
  }

  /**
   * Helper method for doing arithmetic in the backwards search space.
   * @return {Number} - the current end offset, as a start offset in the
   *     backwards search space
   */
  backwardsEndOffset() {
    return this.getEndSearchSpace().length - this.endOffset;
  }

  /**
   * Helper method for doing arithmetic in the backwards search space.
   * @param {Number} backwardsEndOffset - the desired new value of the start
   *     offset in the backwards search space
   */
  setBackwardsEndOffset(backwardsEndOffset) {
    this.endOffset = this.getEndSearchSpace().length - backwardsEndOffset;
  }

  /**
   * Helper method for doing arithmetic in the backwards search space.
   * @return {Number} - the current prefix offset, as a start offset in the
   *     backwards search space
   */
  backwardsPrefixOffset() {
    if (this.prefixOffset == null) return null;
    return this.getPrefixSearchSpace().length - this.prefixOffset;
  }

  /**
   * Helper method for doing arithmetic in the backwards search space.
   * @param {Number} backwardsPrefixOffset - the desired new value of the prefix
   *     offset in the backwards search space
   */
  setBackwardsPrefixOffset(backwardsPrefixOffset) {
    if (this.prefixOffset == null) return;
    this.prefixOffset =
        this.getPrefixSearchSpace().length - backwardsPrefixOffset;
  }
};

/**
 * @param {TextFragment} fragment - the candidate fragment
 * @return {boolean} - true iff the candidate fragment identifies exactly one
 *     portion of the document.
 */
const isUniquelyIdentifying = (fragment) => {
  return fragments.processTextFragmentDirective(fragment).length === 1;
};

/**
 * Analogous to the standard String trim method, but removes any boundary chars,
 * not just whitespace.
 * @param {String} string - the string to trim
 * @return {String} - the trimmed string
 */
const trimBoundary = (string) => {
  const startIndex = string.search(fragments.internal.NON_BOUNDARY_CHARS);

  let endIndex =
      reverseString(string).search(fragments.internal.NON_BOUNDARY_CHARS);
  if (endIndex !== -1) endIndex = string.length - endIndex;

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return '';

  return string.substring(startIndex, endIndex);
};

/**
 * Reverses a string. Compound unicode characters are preserved.
 * @param {String} string - the string to reverse
 * @return {String} - sdrawkcab |gnirts|
 */
const reverseString = (string) => {
  // Spread operator (...) splits full characters, rather than code points, to
  // avoid breaking compound unicode characters upon reverse.
  return [...(string || '')].reverse().join('');
};

/**
 * Determines whether the conditions for an exact match are met.
 * @param {Range} range - the range for which a fragment is being generated.
 * @return {boolean} - true if exact matching (i.e., only textStart) can be
 *     used; false if range matching (i.e., both textStart and textEnd) must be
 *     used.
 */
const canUseExactMatch = (range) => {
  if (range.toString().length > MAX_EXACT_MATCH_LENGTH) return false;
  return !containsBlockBoundary(range);
};

/**
 * Finds the node at which a forward traversal through |range| should begin,
 * based on the range's start container and offset values.
 * @param {Range} range - the range which will be traversed
 * @return {Node} - the node where traversal should begin
 */
const getFirstNodeForBlockSearch = (range) => {
  // Get a handle on the first node inside the range. For text nodes, this
  // is the start container; for element nodes, we use the offset to find
  // where it actually starts.
  let node = range.startContainer;
  if (node.nodeType == Node.ELEMENT_NODE &&
      range.startOffset < node.childNodes.length) {
    node = node.childNodes[range.startOffset];
  }
  return node;
};

/**
 * Finds the node at which a backward traversal through |range| should begin,
 * based on the range's end container and offset values.
 * @param {Range} range - the range which will be traversed
 * @return {Node} - the node where traversal should begin
 */
const getLastNodeForBlockSearch = (range) => {
  // Get a handle on the last node inside the range. For text nodes, this
  // is the end container; for element nodes, we use the offset to find
  // where it actually ends. If the offset is 0, the node itself is returned.
  let node = range.endContainer;
  if (node.nodeType == Node.ELEMENT_NODE && range.endOffset > 0) {
    node = node.childNodes[range.endOffset - 1];
  }
  return node;
};

/**
 * Determines whether or not a range crosses a block boundary.
 * @param {Range} range - the range to investigate
 * @return {boolean} - true if a block boundary was found; false otherwise
 */
const containsBlockBoundary = (range) => {
  const tempRange = range.cloneRange();
  let node = getFirstNodeForBlockSearch(tempRange);
  const walker = makeWalkerForNode(node);
  const map = createForwardOverrideMap(walker);

  while (!tempRange.collapsed && node != null) {
    if (isBlock(node)) return true;
    if (node != null) tempRange.setStartAfter(node);
    node = forwardTraverse(walker, map);
  }
  return false;
};

/**
 * Attempts to find a word start within the given text node, starting at
 * |offset| and working backwards.
 *
 * @param {Node} node - a node to be searched
 * @param {Number|Undefined} startOffset - the character offset within |node|
 *     where the selected text begins. If undefined, the entire node will be
 *     searched.
 * @return {Number} the number indicating the offset to which a range should
 *     be set to ensure it starts on a word bound. Returns -1 if the node is not
 *     a text node, or if no word boundary character could be found.
 */
const findWordStartBoundInTextNode = (node, startOffset) => {
  if (node.nodeType !== Node.TEXT_NODE) return -1;

  const offset = startOffset != null ? startOffset : node.data.length;

  // If the first character in the range is a boundary character, we don't
  // need to do anything.
  if (offset < node.data.length &&
      fragments.internal.BOUNDARY_CHARS.test(node.data[offset]))
    return offset;

  const precedingText = node.data.substring(0, offset);
  const boundaryIndex =
      reverseString(precedingText).search(fragments.internal.BOUNDARY_CHARS);

  if (boundaryIndex !== -1) {
    // Because we did a backwards search, the found index counts backwards
    // from offset, so we subtract to find the start of the word.
    return offset - boundaryIndex;
  }
  return -1;
};

/**
 * Attempts to find a word end within the given text node, starting at |offset|.
 *
 * @param {Node} node - a node to be searched
 * @param {Number|Undefined} endOffset - the character offset within |node|
 *     where the selected text end. If undefined, the entire node will be
 *     searched.
 * @return {Number} the number indicating the offset to which a range should
 *     be set to ensure it ends on a word bound. Returns -1 if the node is not
 *     a text node, or if no word boundary character could be found.
 */
const findWordEndBoundInTextNode = (node, endOffset) => {
  if (node.nodeType !== Node.TEXT_NODE) return -1;

  const offset = endOffset != null ? endOffset : 0;

  // If the last character in the range is a boundary character, we don't
  // need to do anything.
  if (offset < node.data.length && offset > 0 &&
      fragments.internal.BOUNDARY_CHARS.test(node.data[offset - 1])) {
    return offset;
  }

  const followingText = node.data.substring(offset);
  const boundaryIndex = followingText.search(fragments.internal.BOUNDARY_CHARS);

  if (boundaryIndex !== -1) {
    return offset + boundaryIndex;
  }
  return -1;
};

/**
 * Helper method to create a TreeWalker useful for finding a block boundary near
 * a given node.
 * @param {Node} node - the node where the search should start
 * @param {Node|Undefined} endNode - optional; if included, the root of the
 *     walker will be chosen to ensure it can traverse at least as far as this
 *     node.
 * @return {TreeWalker} - a TreeWalker, rooted in a block ancestor of |node|,
 *     currently pointing to |node|, which will traverse only visible text and
 *     element nodes.
 */
const makeWalkerForNode = (node, endNode) => {
  // Find a block-level ancestor of the node by walking up the tree. This
  // will be used as the root of the tree walker.
  let blockAncestor = node;
  const endNodeNotNull = endNode != null ? endNode : node;
  while (!blockAncestor.contains(endNodeNotNull) || !isBlock(blockAncestor)) {
    if (blockAncestor.parentNode) {
      blockAncestor = blockAncestor.parentNode;
    }
  }
  const walker = document.createTreeWalker(
      blockAncestor, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, (node) => {
        return fragments.internal.filterFunction(node);
      });

  walker.currentNode = node;
  return walker;
};

/**
 * Modifies the start of the range, if necessary, to ensure the selection text
 * starts after a boundary char (whitespace, etc.) or a block boundary. Can only
 * expand the range, not shrink it.
 * @param {Range} range - the range to be modified
 */
const expandRangeStartToWordBound = (range) => {
  // Simplest case: If we're in a text node, try to find a boundary char in the
  // same text node.
  const newOffset =
      findWordStartBoundInTextNode(range.startContainer, range.startOffset);
  if (newOffset !== -1) {
    range.setStart(range.startContainer, newOffset);
    return;
  }

  // Also, skip doing any traversal if we're already at the inside edge of
  // a block node.
  if (isBlock(range.startContainer) && range.startOffset === 0) {
    return;
  }

  const walker = makeWalkerForNode(range.startContainer);
  const visited = new Set();
  const origin = walker.currentNode;

  let node = backwardTraverse(walker, visited, origin);
  while (node != null) {
    const newOffset = findWordStartBoundInTextNode(node);
    if (newOffset !== -1) {
      range.setStart(node, newOffset);
      return;
    }

    // If |node| is a block node, then we've hit a block boundary, which counts
    // as a word boundary.
    if (isBlock(node)) {
      if (node.contains(range.startContainer)) {
        // If the selection starts inside |node|, then the correct range
        // boundary is the *leading* edge of |node|.
        range.setStart(node, 0);
      } else {
        // Otherwise, |node| is before the selection, so the correct boundary is
        // the *trailing* edge of |node|.
        range.setStartAfter(node);
      }
      return;
    }

    node = backwardTraverse(walker, visited, origin);
  }
  // We should never get here; the walker should eventually hit a block node
  // or the root of the document. Collapse range so the caller can handle this
  // as an error.
  range.collapse();
};

/**
 * Helper method to create an override map which will "inject" the ancestors of
 * the walker's starting node into traversal order, when using forwardTraverse.
 * By traversing these ancestor nodes after their children (postorder), we can
 * ensure that, if the walker's origin node is inside of a block element, the
 * end of that element is properly treated as a boundary.
 * @param {TreeWalker} walker - the TreeWalker that will be traversed
 * @return {Map<Node, Node>} - the Map to be passed to forwardTraverse
 */
const createForwardOverrideMap = (walker) => {
  // Store the current state so it can be restored at the end.
  const walkerOrigin = walker.currentNode;

  const ancestors = new Set();
  const overrideMap = new Map();

  do {
    // Hold on to the current node so we can reset the walker later.
    const node = walker.currentNode;
    ancestors.add(node);

    // The override map needs to point from the last (grand*)child of |node|
    // back to |node|, so that we traverse |node| only after all of its
    // children. If we hit another ancestor of the origin, use that instead
    // (since it's already part of a postorder chain in our map).
    while (walker.lastChild() != null) {
      if (ancestors.has(walker.currentNode)) {
        break;
      }
    }

    // Set the mapping from the found child to its ancestor.
    if (walker.currentNode !== node) overrideMap.set(walker.currentNode, node);

    // Next, set a mapping from the ancestor to the node it displaced in the
    // ordering. This might get overwritten later if another ancestor needs to
    // get inserted in the ordering too.
    overrideMap.set(node, walker.nextNode());

    // Reset the walker to where it was before we traversed downwards.
    walker.currentNode = node;
  } while (walker.parentNode() != null);

  walker.currentNode = walkerOrigin;
  return overrideMap;
};

/**
 * Performs traversal on a TreeWalker, using document order except when a node
 * has an entry in |overrideMap|, in which case navigation skips to the
 * indicated destination. This is useful for ensuring the ends of block
 * boundaries are found.
 * @param {TreeWalker} walker - the TreeWalker to be traversed
 * @param {Map<Node, Node>} overrideMap - maps nodes to the nodes which should
 *     follow them during traversal, if this differs from document order
 * @return {Node} - |walker|'s new current node, or null if the current node
 *     was unchanged (and thus, no further traversal is possible)
 */
const forwardTraverse = (walker, overrideMap) => {
  if (overrideMap.has(walker.currentNode)) {
    const override = overrideMap.get(walker.currentNode);
    if (override != null) walker.currentNode = override;
    return override;
  }
  return walker.nextNode();
};

/**
 * Performs backwards traversal on a TreeWalker, such that parent nodes are
 * encountered *before* their children (except when they are ancestors of the
 * starting node |origin|). This is useful for finding block boundaries.
 * @param {TreeWalker} walker - the TreeWalker to be traversed
 * @param {Set<Node>} visited - a set used to avoid repeat iterations. Should be
 *     empty the first time this method is called.
 * @param {Node} origin - the node where traversal started
 * @return {Node} - |walker|'s new current node, or null if the current node
 *     was unchanged (and thus, no further traversal is possible)
 */
const backwardTraverse =
    (walker, visited, origin) => {
      // Infinite loop to avoid recursion. Will terminate since visited set
      // guarantees children of a node are only traversed once, and parent node
      // will be null once the root of the walker is reached.
      while (true) {
        // The first time we visit a node, we traverse its children backwards,
        // unless it's an ancestor of the starting node.
        if (!visited.has(walker.currentNode) &&
            !walker.currentNode.contains(origin)) {
          visited.add(walker.currentNode);
          if (walker.lastChild() != null) {
            return walker.currentNode;
          }
        }

        if (walker.previousSibling() != null) {
          return walker.currentNode;
        } else if (walker.parentNode() == null) {
          return null;
        } else if (!visited.has(walker.currentNode)) {
          return walker.currentNode;
        }
      }
    }

/**
 * Modifies the end of the range, if necessary, to ensure the selection text
 * ends before a boundary char (whitespace, etc.) or a block boundary. Can only
 * expand the range, not shrink it.
 * @param {Range} range - the range to be modified
 */
const expandRangeEndToWordBound = (range) => {
  let initialOffset = range.endOffset;

  let node = range.endContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (range.endOffset < node.childNodes.length) {
      node = node.childNodes[range.endOffset];
    }
  }

  const walker = makeWalkerForNode(node);
  const override = createForwardOverrideMap(walker);

  while (node != null) {
    const newOffset = findWordEndBoundInTextNode(node, initialOffset);
    // Future iterations should not use initialOffset; null it out so it is
    // discarded.
    initialOffset = null;

    if (newOffset !== -1) {
      range.setEnd(node, newOffset);
      return;
    }

    // If |node| is a block node, then we've hit a block boundary, which counts
    // as a word boundary.
    if (isBlock(node)) {
      if (node.contains(range.endContainer)) {
        // If the selection starts inside |node|, then the correct range
        // boundary is the *trailing* edge of |node|.
        range.setEnd(node, node.childNodes.length);
      } else {
        // Otherwise, |node| is after the selection, so the correct boundary is
        // the *leading* edge of |node|.
        range.setEndBefore(node);
      }
      return;
    }

    node = forwardTraverse(walker, override);
  }
  // We should never get here; the walker should eventually hit a block node
  // or the root of the document. Collapse range so the caller can handle this
  // as an error.
  range.collapse();
};

/**
 * Helper to determine if a node is a block element or not.
 * @param {Node} node - the node to evaluate
 * @return {Boolean} true iff the node is an element classified as block-level
 */
const isBlock = (node) => {
  return node.nodeType === Node.ELEMENT_NODE &&
      (fragments.internal.BLOCK_ELEMENTS.includes(node.tagName) ||
       node.tagName === 'HTML' || node.tagName === 'BODY');
};

export const forTesting = {
  backwardTraverse: backwardTraverse,
  containsBlockBoundary: containsBlockBoundary,
  createForwardOverrideMap: createForwardOverrideMap,
  expandRangeEndToWordBound: expandRangeEndToWordBound,
  expandRangeStartToWordBound: expandRangeStartToWordBound,
  findWordEndBoundInTextNode: findWordEndBoundInTextNode,
  findWordStartBoundInTextNode: findWordStartBoundInTextNode,
  forwardTraverse: forwardTraverse,
  FragmentFactory: FragmentFactory,
  getSearchSpaceForEnd: getSearchSpaceForEnd,
  getSearchSpaceForStart: getSearchSpaceForStart,
  trimBoundary: trimBoundary,
};

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.fragmentGenerationUtils');
  // clang-format on
}
