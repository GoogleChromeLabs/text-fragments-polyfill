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

  if (canUseExactMatch(range)) {
    return {
      status: GenerateFragmentStatus.SUCCESS,
      fragment:
          {textStart: fragments.internal.normalizeString(range.toString())}
    };
  }
  // Temporarily return INVALID_SELECTION for unsupported cases.
  return {status: GenerateFragmentStatus.INVALID_SELECTION};
};

const canUseExactMatch = (range) => {
  if (range.toString().length > MAX_EXACT_MATCH_LENGTH) return false;
  return !containsBlockBoundary(range);
};

const containsBlockBoundary = (range) => {
  const tempRange = range.cloneRange();

  // Get a handle on the first node inside the range. For text nodes, this is
  // the start container; for element nodes, we use the offset to find where it
  // actually starts.
  let node = tempRange.startContainer;
  if (node.nodeType == Node.ELEMENT_NODE) {
    node = node.childNodes[tempRange.startOffset];
  }

  const walker = makeWalkerForNode(node);
  const map = createOverrideMap(walker);

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
 * @return {TreeWalker} - a TreeWalker, rooted in a block ancestor of |node|,
 *     currently pointing to |node|, which will traverse only visible text and
 *     element nodes.
 */
const makeWalkerForNode = (node) => {
  // Find a block-level ancestor of the node by walking up the tree. This
  // will be used as the root of the tree walker.
  let blockAncestor = node;
  while (!isBlock(blockAncestor)) {
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
  let node = walker.previousNode();
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

    node = walker.previousNode();
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
const createOverrideMap = (walker) => {
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
 * Modifies the end of the range, if necessary, to ensure the selection text
 * ends before a boundary char (whitespace, etc.) or a block boundary. Can only
 * expand the range, not shrink it.
 * @param {Range} range - the range to be modified
 */
const expandRangeEndToWordBound = (range) => {
  let initialOffset = range.endOffset;

  const walker = makeWalkerForNode(range.endContainer);
  const visited = createOverrideMap(walker);

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

    node = forwardTraverse(walker, visited);
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
  containsBlockBoundary: containsBlockBoundary,
  expandRangeEndToWordBound: expandRangeEndToWordBound,
  expandRangeStartToWordBound: expandRangeStartToWordBound,
  findWordEndBoundInTextNode: findWordEndBoundInTextNode,
  findWordStartBoundInTextNode: findWordStartBoundInTextNode,
  forwardTraverse: forwardTraverse,
  createOverrideMap: createOverrideMap,
};

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.fragmentGenerationUtils');
  // clang-format on
}
