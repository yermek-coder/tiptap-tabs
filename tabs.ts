import { mergeAttributes, Node } from "@tiptap/core";

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabs: {
      setTabs: () => ReturnType,
    }
  }
}

export const Tabs = Node.create({
  name: "tabs",
  // Accept only groups of radio input, title and panel
  content: "(tabRadio tabTitle tabPanel)+ tabCreate",
  marks: "",
  group: "block",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div.tabs' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'tabs' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTabs: () => ({ commands }) => {
        // Uniq id for id and for attrs
        // For now using simple random number
        return commands.insertContent({
          type: this.name,
          content: [
            { type: 'tabRadio', },
            { type: 'tabTitle', },
            { type: 'tabPanel', content: [{ type: 'paragraph', text: "" }] },

            { type: 'tabCreate', },
          ]
        });
      },
    }
  },
});
