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

  while (!tempRange.collapsed && node != null) {
    if (isBlock(node)) return true;
    node = walker.nextNode();
    if (node != null) tempRange.setStartBefore(node);
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
const makeWalkerForNode =
    (node) => {
      // Find a block-level ancestor of the node by walking up the tree. This
      // will be used as the root of the tree walker.
      let blockAncestor = node;
      while (!isBlock(blockAncestor)) {
        blockAncestor = blockAncestor.parentNode;
      }
      const walker = document.createTreeWalker(
          blockAncestor, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          (node) => {
            return fragments.internal.filterFunction(node);
          });

      walker.currentNode = node;
      return walker;
    }

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
 * Helper method to generate a visited set suitable for use with forwardTraverse
 * below. The initial state of the set will be such that any ancestors of
 * |walker.currentNode| are already marked visited, since a traversal starting
 * from document root would have done so.
 * @param {TreeWalker} walker - the TreeWalker that will be traversed
 * @return {Set<Node>} - the set to be passed to forwardTraverse
 */
const prepareVisitedSet = (walker) => {
  const visited = new Set();
  for (let node = walker.currentNode; node !== walker.root;
       node = node.parentNode) {
    visited.add(node);
  }
  visited.add(walker.root);
  return visited;
};

/**
 * Performs postorder traversal; i.e., nodes with children are returned only
 * after traversing these children. This allows the ends of block boundaries to
 * be respected.
 * @param {TreeWalker} walker - the TreeWalker to be traversed
 * @param {Set<Node>} visited - the nodes that have already been visited
 * @return {Node} - identical to calling walker.currentNode
 */
const forwardTraverse =
    (walker, visited) => {
      const origin = walker.currentNode;
      // If we've never visited this node before, we need to traverse down.
      if (!visited.has(origin)) {
        visited.add(origin);
        // First, go as deep as possible using children.
        while (walker.firstChild() != null) {
          visited.add(walker.currentNode);
        }

        // Null firstChild means we hit a leaf. If that leaf is not where we
        // started, return it.
        if (origin != walker.currentNode) {
          return walker.currentNode;
        }
      }

      // Next, try to descend a sibling subtree.
      if (walker.nextSibling() != null) {
        do {
          visited.add(walker.currentNode);
        } while (walker.firstChild() != null);

        return walker.currentNode;
      }

      // If we weren't able to find a child or sibling node, visit the parent
      // (this is where the postordering happens).
      return walker.parentNode();
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
  const visited = prepareVisitedSet(walker);

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
        range.setEndAfter(node, node.childNodes.length);
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
  prepareVisitedSet: prepareVisitedSet,
};

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.fragmentGenerationUtils');
  // clang-format on
}
