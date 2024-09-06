import { Node, mergeAttributes } from "@tiptap/core";
import { EditorView, NodeView } from "@tiptap/pm/view"
import { Fragment } from "@tiptap/pm/model"
import { Node as PmNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';


// Panel for tab's content
export const TabPanel = Node.create({
  name: "tabPanel",
  content: "block+",
  marks: "",
  group: "tabs",
  isolating: true,
  defining: true,

  addKeyboardShortcuts() {
    return {
      'Mod-a': ({ editor }) => {
        const { state, view } = editor;
        const { $from, $to } = state.selection;
        const node = $from.node(-1);

        // Prevent selecting whole editor on ctrl+a inside tab
        if (node.type.name === this.name) {
          const from = $from.start(-1);
          const to = $to.end(-1);

          view.dispatch(
            state.tr.setSelection(TextSelection.create(state.doc, from, to))
          );

          return true;
        }

        return false;
      }
    }
  },

  addAttributes() {
    return {
      parent: {
        default: '',
        isRequired: true,
      },
      title: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.panel',
        getAttrs: (dom: HTMLElement) => ({
          parent: dom.getAttribute('parent'),
          title: dom.getAttribute('title'),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div', { class: "panel", ...HTMLAttributes, }, 0
    ];
  },
});

// tab's hidden radio button
export const TabRadio = Node.create({
  name: "tabRadio",
  content: "",
  marks: "",
  group: "tabs",
  atom: true,
  defining: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: '',
        isRequired: true,
      },
      // Editor's view state checked attr
      active: {
        parseHTML: (dom: HTMLElement) => dom.hasAttribute('active'),
        default: false,
      },
      // Final html checked attr
      checked: {
        parseHTML: (dom: HTMLElement) => dom.hasAttribute('checked'),
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'input[type="radio"].radiotab',
        getAttrs: (dom: HTMLElement) => ({
          id: dom.getAttribute('id'),
          active: dom.hasAttribute('active'),
          checked: dom.hasAttribute('checked'),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'input',
      mergeAttributes(HTMLAttributes, {
        class: 'radiotab',
        type: 'radio',
        name: 'tabs',
        id: node.attrs.id,
        active: node.attrs.active ? '' : null,
        checked: node.attrs.checked ? '' : null,
      })
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      return new TabRadioView(node, editor.view, getPos as () => number)
    };
  },
});

// View needs to handle tabs toggling in editor
class TabRadioView {
  node: PmNode;
  view: EditorView;
  getPos: () => number;
  dom: HTMLInputElement;

  constructor(node: PmNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    setTimeout(() => {
      const attrs = this.updateAttrs();
      this.update({ ...this.node, attrs });
    });

    this.dom = document.createElement('input');
    this.dom.classList.add('radiotab');
    this.dom.setAttribute('type', 'radio');

    this.dom.addEventListener('change', this.handleChange.bind(this));
  }

  update(node) {
    if (node.type.name === 'tabRadio') {
      this.dom.setAttribute('id', node.attrs.id);
      this.dom.checked = node.attrs.active;

      const pos = this.getPos();
      const { path } = this.view.state.doc.resolve(pos) as any;
      this.dom.setAttribute('name', ['tabs', ...path.filter(Number.isInteger).slice(-4, -2)].join('_'));

      return true;
    }
  }

  updateAttrs() {
    const pos = this.getPos();
    const { parent, path } = this.view.state.doc.resolve(pos) as any;
    const attrs = { ...this.node.attrs };

    const isFirstChild = parent && parent.firstChild === this.node;
    let activeTabExist = attrs.active;
    if (!activeTabExist) {
      parent.forEach((child) => {
        activeTabExist = child.type.name === 'tabRadio' && child.attrs.active
      });
    }

    if (isFirstChild && !attrs.active && !activeTabExist) {
      attrs.active = true;
      attrs.checked = true;
      const tr = this.view.state.tr;
      tr.setNodeMarkup(pos, null, attrs);
      this.view.dispatch(tr);
    }

    // Find the index of the current node within its parent
    let nodeIndex = 0;
    for (let i = 0; i < parent.childCount; i++) {
      if (parent.child(i).eq(this.node)) {
        nodeIndex = i;
        break;
      }
    }

    // Create new id for sibling tab nodes
    const id = ['tab', ...path.filter(Number.isInteger)].join('_')
    attrs.id = id;
    const tr = this.view.state.tr;
    tr.setNodeAttribute(pos, 'id', id);
    tr.setNodeAttribute(pos + 1, 'for', id);
    tr.setNodeAttribute(pos + 2, 'parent', id);
    this.view.dispatch(tr);

    return attrs
  }

  handleChange() {
    const pos = this.getPos();
    const resolvedPos = this.view.state.doc.resolve(pos);
    const tr = this.view.state.tr;

    resolvedPos.parent.forEach((node, _, index) => {
      if (node.type.name === 'tabRadio') {
        tr.setNodeAttribute(resolvedPos.posAtIndex(index), 'active', false);
      }
    });

    tr.setNodeAttribute(pos, 'active', true);

    this.view.dispatch(tr);
  }

  destroy() {
    this.dom.removeEventListener('change', this.handleChange);
  }
}

// tab title

export const TabTitle = Node.create({
  name: "tabTitle",
  content: "",
  marks: "",
  group: "tabs",
  atom: true,
  selectable: false,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: 'New tab',
      },
      for: {
        default: '',
        isRequired: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'label.label',
        getAttrs: (dom: HTMLElement) => ({
          title: dom.firstChild.textContent,
          for: dom.getAttribute('for'),
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'label', { class: 'label', for: node.attrs.for }, node.attrs.title,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      return new TabTitleView(node, editor.view, getPos as () => number);
    };
  },
});

// This view contains title, popup menu with trigger button, menu, input
// and delete button
export class TabTitleView implements NodeView {
  node: PmNode;
  view: EditorView;
  getPos: () => number;

  dom: HTMLElement;
  contentDOM: HTMLElement;
  toggle: HTMLElement;
  titleInput: HTMLElement;
  deleteBtn: HTMLElement;
  menuEl: HTMLElement;

  constructor(node: PmNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('label');
    this.dom.className = 'label';
    this.dom.textContent = this.node.attrs.title;

    setTimeout(() => {
      // this.node.attrs.for && this.update(this.node)
      this.updateAttrs()
    }, 1);

    if (this.view.editable) {
      const toggle = document.createElement('button');
      toggle.setAttribute('role', 'button');
      toggle.classList.add('menu-toggle');
      toggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots-vertical" viewBox="0 0 16 16">
        <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
      </svg>
    `;
      this.toggle = toggle;
      this.dom.append(this.toggle);
      this.toggle.addEventListener('click', this.showMenu.bind(this));
      document.addEventListener('click', this.hideMenu.bind(this));

      const menu = document.createElement('div');
      menu.classList.add('menu-body');
      this.dom.append(menu);
      this.menuEl = menu;

      const input = document.createElement('input');
      input.setAttribute('type', 'text');
      this.titleInput = input;
      this.menuEl.append(input);
      this.titleInput.addEventListener('change', this.onTitleChange.bind(this));

      const button = document.createElement('button');
      button.innerText = 'Delete'
      this.deleteBtn = button;
      this.menuEl.append(this.deleteBtn);
      this.deleteBtn.addEventListener('click', this.removeTab.bind(this));
    }
  }

  showMenu(e) {
    if (e.target.closest('.menu-toggle') === this.toggle) {
      this.menuEl.classList.toggle('show');
      this.titleInput.focus();
    }
  }

  hideMenu(e) {
    if (!e.target.closest('.menu-body') && !e.target.closest('.menu-toggle')) {
      this.menuEl.classList.remove('show')
    }
  }

  stopEvent(e) {
    return e.target.isEqualNode(this.titleInput)
  }

  updateAttrs() {
    const pos = this.getPos();
    const attrs = { ...this.node.attrs }
    const resolvedPos = this.view.state.doc.resolve(pos);
    const id = resolvedPos.nodeBefore.attrs.id;
    const tr = this.view.state.tr;

    // hack to restore title when being copied (selectable: false nodes get lost when copied)
    const title = resolvedPos.nodeAfter.attrs.title;
    if (title) {
      tr.setNodeAttribute(pos, 'title', title);
      attrs.title = title || attrs.title;
    }

    if (this.node.attrs.for !== id) {
      tr.setNodeAttribute(pos, 'for', id);
      this.view.dispatch(tr);
      attrs.for = id;
    }

    this.update({ ...this.node, attrs })
  }

  update(node) {
    if (node.type.name === 'tabTitle') {
      this.dom.setAttribute('for', node.attrs.for);
      this.dom.firstChild.textContent = node.attrs.title;
      (this.titleInput as HTMLInputElement).value = ''
      return true;
    }
  }

  onTitleChange(e) {
    const oldTitle = this.node.attrs.title;
    if (oldTitle !== e.target.value) {
      const pos = this.getPos();
      const tr = this.view.state.tr;

      tr.setNodeAttribute(pos, 'title', e.target.value);
      // hack to save title on copy
      tr.setNodeAttribute(pos + 1, 'title', e.target.value);

      this.view.dispatch(tr);
    }
  }

  removeTab() {
    const pos = this.getPos();
    const resolvedPos = this.view.state.doc.resolve(pos);
    const tr = this.view.state.tr;
    const parentPos = resolvedPos.start();

    let wasActive = false;

    const deleteRange = { start: Infinity, end: -Infinity }
    resolvedPos.parent.forEach((node, _, index) => {
      if (['tabRadio', 'tabTitle', 'tabPanel'].includes(node.type.name) && [node.attrs?.id, node.attrs?.for, node.attrs?.parent].includes(this.node.attrs.for)) {
        const nodePos = resolvedPos.posAtIndex(index);
        deleteRange.start = Math.min(deleteRange.start, nodePos);
        deleteRange.end = Math.max(deleteRange.end, nodePos + node.nodeSize);
        wasActive = wasActive || node.attrs?.active;
      }
    })

    // Single tab
    if (resolvedPos.parent.content.childCount <= 4) {
      deleteRange.start = parentPos;
      tr.deleteRange(deleteRange.start, deleteRange.end + 1);
    } else {
      tr.deleteRange(deleteRange.start, deleteRange.end);
    }

    this.view.dispatch(tr);
  }

  destroy() {
    if (this.view.editable) {
      this.toggle.removeEventListener('click', this.showMenu);
      this.titleInput.removeEventListener('input', this.onTitleChange);
      this.deleteBtn.removeEventListener('click', this.removeTab);
      document.removeEventListener('click', this.hideMenu);
    }
  }
}

// new tab button

export const TabCreate = Node.create({
  name: "tabCreate",
  content: "",
  marks: "",
  group: "tabs",
  atom: true,
  selectable: false,
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'button.tab-create',
      },
    ];
  },

  renderHTML() {
    return [
      'button',
      {
        style: 'display: none',
        class: 'button.tab-create',
      },
      "+"
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      return new TabCreateView(node, editor.view, getPos as () => number);
    };
  },
});

export class TabCreateView implements NodeView {
  node: PmNode;
  view: EditorView;
  getPos: () => number;
  dom: HTMLElement;

  constructor(node: PmNode, view: EditorView, getPos: () => number) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    if (this.view.editable) {
      this.dom = document.createElement('button');
      this.dom.className = 'tab-create';
      this.dom.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>
    </svg>
    `;

      this.dom.addEventListener('click', this.handleClick.bind(this));
    }
  }

  handleClick() {
    const { state, dispatch } = this.view;
    const pos = this.getPos();

    const tabRadio = state.schema.nodes.tabRadio.create();
    const tabTitle = state.schema.nodes.tabTitle.create();
    const tabPanel = state.schema.nodes.tabPanel.create({}, state.schema.nodes.paragraph.create());
    const fragment = Fragment.fromArray([tabRadio, tabTitle, tabPanel]);

    const tr = state.tr;
    tr.insert(pos - 1, fragment);
    dispatch(tr);
  }

  destroy() {
    if (this.view.editable) {
      this.dom.removeEventListener('click', this.handleClick);
    }
  }
}

export default [TabPanel, TabRadio, TabTitle, TabCreate]