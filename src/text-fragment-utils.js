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

/**
 * @typedef {Object} TextFragment
 * @property {string} textStart
 * @property {string} textEnd
 * @property {string} prefix
 * @property {string} suffix
 */

const FRAGMENT_DIRECTIVES = ['text'];

// Block elements. elements of a text fragment cannot cross the boundaries of a block element.
// Source for the list : https://www.w3schools.com/html/html_blocks.asp
const BLOCK_ELEMENTS = [
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'CANVAS',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'NOSCRIPT',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TFOOT',
  'UL',
  'VIDEO',
];

/**
 * Get all text fragments from a string
 * @param {string} hash - string retrieved from Location#hash.
 * @return {{text: string[]}} Text Fragments contained in the hash.
 */
export const getFragmentDirectives = (hash) => {
  const fragmentDirectivesStrings = hash
    .replace(/#.*?:~:(.*?)/, '$1')
    .split(/&?text=/)
    .filter(Boolean);
  if (!fragmentDirectivesStrings.length) {
    return {};
  } else {
    return { text: fragmentDirectivesStrings };
  }
};

/**
 * Decompose text fragment strings into objects, describing each part of each text fragment.
 * @param {{text: string[]}} fragmentDirectives - Text fragment to decompose into separate elements.
 * @return {{text: TextFragment[]}} Text Fragments, each containing textStart, textEnd, prefix and suffix.
 */
export const parseFragmentDirectives = (fragmentDirectives) => {
  const parsedFragmentDirectives = {};
  for (const [
    fragmentDirectiveType,
    fragmentDirectivesOfType,
  ] of Object.entries(fragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      parsedFragmentDirectives[
        fragmentDirectiveType
      ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
        return parseTextFragmentDirective(fragmentDirectiveOfType);
      });
    }
  }
  return parsedFragmentDirectives;
};

/**
 * Decompose a string into an object containing all the parts of a text fragment.
 * @param {string} textFragment - String to decompose.
 * @return {TextFragment} Object containing textStart, textEnd, prefix and suffix of the text fragment.
 */
const parseTextFragmentDirective = (textFragment) => {
  const TEXT_FRAGMENT = /^(?:(.+?)-,)?(?:(.+?))(?:,(.+?))?(?:,-(.+?))?$/;
  return {
    prefix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$1')),
    textStart: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$2')),
    textEnd: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$3')),
    suffix: decodeURIComponent(textFragment.replace(TEXT_FRAGMENT, '$4')),
  };
};

/**
 * Mark the text fragments with `<mark>` tags.
 * @param {{text: TextFragment[]}} parsedFragmentDirectives - Text fragments to process.
 * @return {{text: (Element | undefined)[]}} `<mark>` elements created to highlight the text fragments.
 */
export const processFragmentDirectives = (parsedFragmentDirectives) => {
  const processedFragmentDirectives = {};
  for (const [
    fragmentDirectiveType,
    fragmentDirectivesOfType,
  ] of Object.entries(parsedFragmentDirectives)) {
    if (FRAGMENT_DIRECTIVES.includes(fragmentDirectiveType)) {
      processedFragmentDirectives[
        fragmentDirectiveType
      ] = fragmentDirectivesOfType.map((fragmentDirectiveOfType) => {
        return processTextFragmentDirective(fragmentDirectiveOfType);
      });
    }
  }
  return processedFragmentDirectives;
};

/**
 * Highlights a text fragment by surrounding it in a `<mark>` element.
 *
 * Note : If a text fragment only partially intersects an element, the text
 * fragment will be extended to highlight the entire element.
 * @param {TextFragment} textFragment - Text Fragment to highlight.
 * @return {Element?} `<mark>` element created to highlight the text fragment, if an exact and distinct match was found.
 */
const processTextFragmentDirective = (textFragment) => {
  const prefixNodes = findText(textFragment.prefix);
  const textStartNodes = findText(textFragment.textStart);
  const textEndNodes = findText(textFragment.textEnd);
  const suffixNodes = findText(textFragment.suffix);
  const mark = document.createElement('mark');
  if (
    !prefixNodes.length &&
    !suffixNodes.length &&
    textStartNodes.length === 1
  ) {
    let startNode;
    let startOffset;
    let endNode;
    let endOffset;
    // Only `textStart`
    if (!textEndNodes.length) {
      [startNode, startOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        true,
      );
      [endNode, endOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        false,
      );
      // Only `textStart` and `textEnd`
    } else if (textEndNodes.length === 1) {
      [startNode, startOffset] = findRangeNodeAndOffset(
        textStartNodes[0],
        textFragment.textStart,
        true,
      );
      [endNode, endOffset] = findRangeNodeAndOffset(
        textEndNodes[0],
        textFragment.textEnd,
        false,
      );
    }
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    try {
      range.surroundContents(mark);
    } catch {
      // Text to highlight does not contain entire DOM nodes.
      // Need to extend the highlighted selection to entire nodes (Ex: entire links).
      const commonAncestor = range.commonAncestorContainer;
      while (startNode.parentNode !== commonAncestor) {
        startNode = startNode.parentNode;
        range.setStartBefore(startNode);
      }
      while (endNode.parentNode !== commonAncestor) {
        endNode = endNode.parentNode;
        range.setEndAfter(endNode);
      }
      try {
        range.surroundContents(mark);
      } catch {
        // Text highlight still didn't work.
        return;
      }
    }
  }
  if (prefixNodes.length) {
    // ToDo
  }
  if (mark.parentElement) {
    return mark;
  } else {
    return;
  }
};

/**
 * Scrolls an element into view, following the recommendation of
 * https://wicg.github.io/scroll-to-text-fragment/#navigating-to-text-fragment
 * @param {Element} element - Element to scroll into view.
 */
export const scrollElementIntoView = (element) => {
  const behavior = {
    behavior: 'auto',
    block: 'center',
    inline: 'nearest',
  };
  element.scrollIntoView(behavior);
};

/**
 * Finds the DOM Node and the exact offset where a string starts or ends.
 * @param {Node} blockNode - Block element in which to search for a given text.
 * @param {string} text - The text for which to find the position.
 * @param {boolean} start - Whether to return the an offset for the start or the text, or the end.
 * @return {[Node, number]} The DOM Node and the offset where the text starts or ends.
 */
const findRangeNodeAndOffset = (blockNode, text, start) => {
  let offset = blockNode.textContent.indexOf(text) + (start ? 0 : text.length);
  const startChildren = [];
  const treeWalker = document.createTreeWalker(blockNode, NodeFilter.SHOW_TEXT);
  let node = treeWalker.nextNode();
  if (node) {
    startChildren.push({
      node,
      start: 0,
      end: node.textContent.length,
    });
  }
  while ((node = treeWalker.nextNode())) {
    startChildren.push({
      node: node,
      start: startChildren[startChildren.length - 1].end,
      end:
        startChildren[startChildren.length - 1].end + node.textContent.length,
    });
  }
  let anchorNode;
  for (const { node, start, end } of startChildren) {
    if (offset >= start && offset < end) {
      anchorNode = node;
      offset -= start;
      break;
    }
  }
  return [anchorNode, offset];
};

/**
 * Finds the deepest block elements that contain the entire given text.
 * @param {string} text - Text to find.
 * @return {Node[]} List of block elements that contain the text.
 * None of the elements contain another one from the list.
 */
const findText = (text) => {
  if (!text) {
    return [];
  }
  const body = document.body;
  const treeWalker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (!BLOCK_ELEMENTS.includes(node.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (
        [...node.childNodes].some((n) => BLOCK_ELEMENTS.includes(n.tagName))
      ) {
        return NodeFilter.FILTER_SKIP;
      }
      if (node.textContent.includes(text)) {
        return NodeFilter.FILTER_ACCEPT;
      }
    },
  });

  const nodeList = [];
  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    nodeList.push(currentNode);
  }
  return nodeList;
};
