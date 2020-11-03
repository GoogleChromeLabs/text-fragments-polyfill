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

  const fragment = {};

  if (canUseExactMatch(range)) {
    fragment.textStart = fragments.internal.normalizeString(range.toString());
    // TODO: check for ambiguity and maybe add context in these cases.
    return {
      status: GenerateFragmentStatus.SUCCESS,
      fragment: fragment,
    };
  } else {
    // We have to use textStart and textEnd to identify a range. First, break
    // the range up based on block boundaries, as textStart/textEnd can't cross
    // these.
    // const searchSpace = getSearchSpaceForStartAndEnd(range);

    // TODO: choose progressively longer prefixes of the start search space, and
    // suffixes of the end search space, until we hit a combination that
    // uniquely identifies the desired fragment.
  }

  // Temporarily return INVALID_SELECTION for unsupported cases.
  return {status: GenerateFragmentStatus.INVALID_SELECTION};
};

/**
 * Finds the search space for the textStart parameter when using range match.
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
 * Finds the search space for the textEnd parameter when using range match.
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
    // search, we use either its leading or trailing edge as our start.
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
 * Analogous to the standard String trim method, but removes any boundary chars,
 * not just whitespace.
 * @param {String} string - the string to trim
 * @return {String} - the trimmed string
 */
const trimBoundary = (string) => {
  const startIndex = string.search(fragments.internal.NON_BOUNDARY_CHARS);

  // Search backwards. Spread operator (...) splits full characters, rather
  // than code points, to avoid breaking unicode characters upon reverse.
  let endIndex = [...string].reverse().join('').search(
      fragments.internal.NON_BOUNDARY_CHARS);
  if (endIndex !== -1) endIndex = string.length - endIndex;

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) return '';

  return string.substring(startIndex, endIndex);
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
  if (node.nodeType == Node.ELEMENT_NODE) {
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
  // Search backwards through text for a boundary char. Spread operator (...)
  // splits full characters, rather than code points, to avoid breaking
  // unicode characters upon reverse.
  const boundaryIndex = [...precedingText].reverse().join('').search(
      fragments.internal.BOUNDARY_CHARS);

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
    blockAncestor = blockAncestor.parentNode;
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

  while (walker.parentNode() != null) {
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
  }

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

  const walker = makeWalkerForNode(range.endContainer);
  const override = createForwardOverrideMap(walker);

  let node = walker.currentNode;
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
