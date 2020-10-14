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

  return {
    status: GenerateFragmentStatus.SUCCESS,
    fragment: {textStart: fragments.internal.normalizeString(range.toString())}
  };
};

/**
 * Attempts to find a word start within the given text node, starting at
 * |offset| and working backwards.
 *
 * @param {Node} node - a node to be searched
 * @param {Number|Undefined} startOffset - the character offset within |node|
 *     where the selected text begins. If undefined, the
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

  // Find a block-level ancestor of the range's start node by walking up the
  // tree. This will be used as the root of the tree walker.
  let blockAncestor = range.startContainer;
  while (!fragments.internal.BLOCK_ELEMENTS.includes(blockAncestor.tagName) &&
         blockAncestor.tagName !== 'HTML' && blockAncestor.tagName !== 'BODY') {
    blockAncestor = blockAncestor.parentNode;
  }
  const walker = document.createTreeWalker(
      blockAncestor, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, (node) => {
        return fragments.internal.filterFunction(node);
      });

  walker.currentNode = range.startContainer;
  let node = walker.previousNode();
  while (node != null) {
    const newOffset = findWordStartBoundInTextNode(node);
    if (newOffset !== -1) {
      range.setStart(node, newOffset);
      return;
    }

    // If |node| is a block node, then we've hit a block boundary, which counts
    // as a word boundary.
    if (node.nodeType === Node.ELEMENT_NODE &&
        (fragments.internal.BLOCK_ELEMENTS.includes(node.tagName) ||
         node.tagName === 'HTML' || node.tagName === 'BODY')) {
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

export const forTesting = {
  expandRangeStartToWordBound: expandRangeStartToWordBound,
  findWordStartBoundInTextNode: findWordStartBoundInTextNode,
};

// Allow importing module from closure-compiler projects that haven't migrated
// to ES6 modules.
if (typeof goog !== 'undefined') {
  // clang-format off
  goog.declareModuleId('googleChromeLabs.textFragmentPolyfill.fragmentGenerationUtils');
  // clang-format on
}
