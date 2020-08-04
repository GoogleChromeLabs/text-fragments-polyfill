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

/**
 * @typedef NodeAndOffset
 * @property {Node} node
 * @property {number} offset
 */

/**
 * @typedef MarkOptions
 * @property {NodeAndOffset?} start
 * @property {NodeAndOffset?} end
 * @property {Node?} startBefore
 * @property {Node?} startAfter
 * @property {Node?} endBefore
 * @property {Node?} endAfter
 */

const FRAGMENT_DIRECTIVES = ['text'];

// Block elements. elements of a text fragment cannot cross the boundaries of a
// block element. Source for the list:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements#Elements
const BLOCK_ELEMENTS = [
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DETAILS',
  'DIALOG',
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
  'HGROUP',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
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
 * @return {{text: (Element[])[]}} `<mark>` elements created to highlight the text fragments.
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
 * @return {Element[]} `<mark>` element created to highlight the text fragment, if an exact and distinct match was found.
 */
const processTextFragmentDirective = (textFragment) => {
  const prefixNodes = findText(textFragment.prefix);
  const textStartNodes = findText(textFragment.textStart);
  const textEndNodes = findText(textFragment.textEnd);
  const suffixNodes = findText(textFragment.suffix);

  if (
    prefixNodes.length > 1 ||
    textStartNodes.length > 1 ||
    textEndNodes.length > 1 ||
    suffixNodes.length > 1
  ) {
    return [];
  }

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
      return [mark];
    } catch {
      // Text to highlight does not contain entire DOM elements.
      // Need to create multiple <mark> elements to highlight the entire selection.
      const commonAncestor = range.commonAncestorContainer;
      const startMarks = [];
      let firstNode = startNode;
      startMarks.push(
        createMarkFor(firstNode, {
          start: { node: firstNode, offset: startOffset },
        }),
      );
      firstNode = startMarks[0];
      while (firstNode.parentNode !== commonAncestor) {
        const parent = firstNode.parentNode;
        let nodesToHighlight = Array.from(parent.childNodes);
        nodesToHighlight = nodesToHighlight.slice(
          nodesToHighlight.indexOf(firstNode) + 1,
        );
        startMarks.push(...highlightNodes(nodesToHighlight));
        firstNode = parent;
      }
      const endMarks = [];
      let lastNode = endNode;
      endMarks.push(
        createMarkFor(lastNode, { end: { node: lastNode, offset: endOffset } }),
      );
      lastNode = endMarks[0];
      while (lastNode.parentNode !== commonAncestor) {
        const parent = lastNode.parentNode;
        let nodesToHighlight = Array.from(parent.childNodes);
        nodesToHighlight = nodesToHighlight.slice(
          0,
          nodesToHighlight.indexOf(lastNode),
        );
        endMarks.push(...highlightNodes(nodesToHighlight));
        lastNode = parent;
      }
      let nodesInBetween = Array.from(commonAncestor.childNodes);
      nodesInBetween = nodesInBetween.slice(
        nodesInBetween.indexOf(firstNode) + 1,
        nodesInBetween.indexOf(lastNode),
      );
      return [
        ...startMarks.filter(Boolean),
        ...highlightNodes(nodesInBetween),
        ...endMarks.filter(Boolean),
      ];
    }
  }
  if (prefixNodes.length) {
    // ToDo
  }
};

/**
 * Highlights the provided nodes entirely. Creates as few `<mark>` elements as possible.
 * @param {Node[]} nodes
 * @return {Element[]} mark elements created.
 */
const highlightNodes = (nodes) => {
  if (!nodes || !nodes.length) return [];

  const createdMarks = [];
  let firstNode = nodes[0];
  let lastNode = firstNode;
  for (let i = 0; i < nodes.length; ++i) {
    lastNode = nodes[i];
    if (BLOCK_ELEMENTS.includes(lastNode.tagName)) {
      createdMarks.push(
        createMarkFor(null, { startBefore: firstNode, endBefore: lastNode }),
      );
      createdMarks.push(...highlightNodes(Array.from(lastNode.childNodes)));
      firstNode = nodes[i + 1];
      lastNode = firstNode;
      ++i;
    }
  }
  if (firstNode && lastNode) {
    if (BLOCK_ELEMENTS.includes(firstNode.tagName)) {
      createdMarks.push(...highlightNodes(firstNode.childNodes));
      createdMarks.push(
        createMarkFor(null, { startAfter: firstNode, endAfter: lastNode }),
      );
    } else {
      createdMarks.push(
        createMarkFor(null, { startBefore: firstNode, endAfter: lastNode }),
      );
    }
  }
  return createdMarks.filter(Boolean);
};

/**
 * Creates a mark and surround the wanted range in it. Will not create an element if the range is collapsed.
 * @param {Node} baseNode
 * @param {MarkOptions} options
 * @return {Element | undefined} Mark created for the range, if the range is not collapsed.
 */
const createMarkFor = (baseNode, options) => {
  const range = document.createRange();
  if (baseNode) range.selectNodeContents(baseNode);

  if (options) {
    if (options.startBefore) {
      range.setStartBefore(options.startBefore);
    } else if (options.startAfter) {
      range.setStartAfter(options.startAfter);
    } else if (options.start) {
      range.setStart(options.start.node, options.start.offset);
    }

    if (options.endBefore) {
      range.setEndBefore(options.endBefore);
    } else if (options.endAfter) {
      range.setEndAfter(options.endAfter);
    } else if (options.end) {
      range.setEnd(options.end.node, options.end.offset);
    }
  }

  if (!range.collapsed) {
    const mark = document.createElement('mark');
    range.surroundContents(mark);
    return mark;
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
 * @param {HTMLElement} blockNode - Block element in which to search for a given text.
 * @param {string} text - The text for which to find the position.
 * @param {boolean} start - Whether to return the an offset for the start or the text, or the end.
 * @return {[Node, number]} The DOM Node and the offset where the text starts or ends.
 */
const findRangeNodeAndOffset = (blockNode, text, start) => {
  const fullText = blockNode.innerText.replace(/\s/g, ' ');
  let offset = fullText.indexOf(text) + (start ? 0 : text.length);
  const startChildren = [];
  const treeWalker = document.createTreeWalker(blockNode, NodeFilter.SHOW_TEXT);
  let node = treeWalker.nextNode();
  if (node) {
    const trimmedContent = node.textContent.replace(/^\s+/, '').replace(/\s+$/, '');
    startChildren.push({
      node,
      startOffset: 0,
      endOffset: trimmedContent.length,
      textStart: node.textContent.indexOf(trimmedContent),
    });
  }
  while ((node = treeWalker.nextNode())) {
    const trimmedContent = node.textContent.replace(/^\s+/, ' ').replace(/\s+$/, '');
    startChildren.push({
      node: node,
      startOffset: startChildren[startChildren.length - 1].endOffset,
      endOffset:
        startChildren[startChildren.length - 1].endOffset + trimmedContent.length,
      textStart: node.textContent.indexOf(trimmedContent),
    });
  }
  let anchorNode;
  for (const { node, startOffset, endOffset, textStart } of startChildren) {
    if (offset >= startOffset && offset < endOffset) {
      anchorNode = node;
      offset = offset - startOffset + textStart;
      break;
    }
  }
  return [anchorNode, offset];
};

/**
 * Finds block elements that directly contain a given text.
 * @param {string} text - Text to find.
 * @return {HTMLElement[]} List of block elements that contain the text.
 * None of the elements contain another one from the list.
 */
const findText = (text) => {
  if (!text) {
    return [];
  }

  // List of block items that contain the text we're looking for.
  const blockElements = Array.from(
    getElementsIn(document.body, (element) => {
      if(BLOCK_ELEMENTS.includes(element.tagName) && element.innerText.replace(/\s/g, ' ').includes(text)) {
        return NodeFilter.FILTER_ACCEPT;
      } else {
        return NodeFilter.FILTER_REJECT;
      }
    }),
  );

  const matches = [];
  for(const element of blockElements) {
    const textParts = Array.from(element.children).reduce((parts, child) => {
      if(BLOCK_ELEMENTS.includes(child.tagName)) {
        return [...parts.slice(0, -1), ...parts.slice(-1)[0].split(child.innerText)];
      } else {
        return parts;
      }
    }, [element.innerText]);
    for(const textPart of textParts.map(part => part.replace(/\s/g, ' '))) {
      if(textPart.includes(text)) {
        matches.push(element);
      }
    }
  }
  return matches;
};

/**
 * @callback ElementFilterFunction
 * @param {HTMLElement} element - Node to accept, reject or skip.
 * @returns {number} Either NodeFilter.FILTER_ACCEPT, NodeFilter.FILTER_REJECT or NodeFilter.FILTER_SKIP.
 */

/**
 * Returns all nodes inside root using the provided filter.
 * @generator
 * @param {Node} root - Node where to start the TreeWalker.
 * @param {ElementFilterFunction} filter - Filter provided to the TreeWalker's acceptNode filter.
 * @yield {HTMLElement} All elements that were accepted by filter.
 */
function* getElementsIn(root, filter) {
  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: filter,
  });

  let currentNode;
  while ((currentNode = treeWalker.nextNode())) {
    yield currentNode;
  }
}
