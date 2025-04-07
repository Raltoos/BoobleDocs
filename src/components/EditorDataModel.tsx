import { CursorPosition } from "./TextEditor";

//Each character is stored as a node like this with pointers to next and prev
class CharNode {
  id: string;
  char: string;
  position: number;
  next: CharNode | null;
  prev: CharNode | null;
  author: string;

  constructor(id: string, char: string, position: number, author: string) {
    this.id = id;
    this.char = char;
    this.position = position;
    this.next = null;
    this.prev = null;
    this.author = author;
  }
}

export class EditorDataModel {
  private head: CharNode | null;
  private tail: CharNode | null;
  public index: CharNode[];
  public userId: string;
  public documentId: string;

  public cursor_position: number = 0;

  private lineStartPositions: number[] = [0];
  private lineWidths: number[] = [];

  constructor(userId: string, documentId: string = "default") {
    this.head = null;
    this.tail = null;
    this.index = [];
    this.userId = userId;
    this.documentId = documentId;
  }

  private generateID(): string {
    return `${this.userId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  // Insert a character at the specified position
  // skipLocalUpdate flag is used when applying remote operations
  insertChar(char: string, pos: number, skipLocalUpdate = true) {
    const newNode = new CharNode(this.generateID(), char, pos, this.userId);

    //empty
    if (!this.head) {
      this.head = this.tail = newNode;
      this.index.push(newNode);
      if (skipLocalUpdate && this.cursor_position >= pos) {
        this.cursor_position += 1;
      }
      return;
    }

    const adjustedPos = Math.min(pos, this.index.length);

    if (adjustedPos === this.index.length) {
      const lastNode = this.tail;
      if (lastNode) {
        lastNode.next = newNode;
        newNode.prev = lastNode;
        this.tail = newNode;
      }
      this.index.push(newNode);
      if (skipLocalUpdate && this.cursor_position >= pos) {
        this.cursor_position += 1;
      }
      return;
    }

    // Insert in the middle or beginning
    const existingNode = this.index[adjustedPos];
    const prevNode = existingNode.prev;

    if (prevNode) {
      prevNode.next = newNode;
      newNode.prev = prevNode;
    } else {
      this.head = newNode;
    }

    newNode.next = existingNode;
    existingNode.prev = newNode;

    this.index.splice(adjustedPos, 0, newNode);
    this.updatePositions();

    if (char === "\n") {
      this.updateLineInfo();
    }

    if (skipLocalUpdate && this.cursor_position >= pos) {
      this.cursor_position += 1;
    }
  }

  // Delete a character at the specified position
  // skipLocalUpdate flag is used when applying remote operations
  deleteChar(pos: number, skipLocalUpdate = true) {
    if (pos < 0 || pos >= this.index.length) return;

    const node = this.index[pos];

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;

    // Update head/tail
    if (this.head === node) this.head = node.next;
    if (this.tail === node) this.tail = node.prev;

    this.index.splice(pos, 1);
    this.updatePositions();
    this.updateLineInfo();

    if (skipLocalUpdate && this.cursor_position > pos) {
      this.cursor_position -= 1;
    }
  }

  private updateLineInfo(): void {
    const text = this.getRawText();
    this.lineStartPositions = [0];
    this.lineWidths = [];

    let lineWidth = 0;

    for (let i = 0; i < text.length; i++) {
      lineWidth++;
      if (text[i] === "\n") {
        this.lineStartPositions.push(i + 1);
        this.lineWidths.push(lineWidth);
        lineWidth = 0;
      }
    }

    this.lineWidths.push(lineWidth);
  }

  private updatePositions() {
    this.index.forEach((node, index) => {
      node.position = index;
    });
  }

  clearContent() {
    this.head = null;
    this.tail = null;
    this.index = [];
    this.cursor_position = 0;
    this.lineStartPositions = [0];
    this.lineWidths = [];
  }

  setText(text: string) {
    this.clearContent();
    for (let i = 0; i < text.length; i++) {
      this.insertChar(text[i], i, false);
    }

    this.updateLineInfo();
  }

  getRawText(): string {
    return this.index.map((node) => node.char).join("");
  }

  getTextwithAllCursors(otherCursors: CursorPosition[]): string {
    const text = this.getRawText();

    // const allCursors = [
    //   ...otherCursors,
    //   { userId: this.userId, position: this.cursor_position, color: "" },
    // ];
    const allCursors = [...otherCursors];

    allCursors.sort((a, b) => b.position - a.position);

    let result = text;

    for (const cursor of allCursors) {
      const isSelf = cursor.userId === this.userId;
      const position = Math.min(cursor.position, text.length);

      let cursorHTML;
      if (isSelf) {
        cursorHTML =
          "<span class='cursor blink' style='width: 2px; height: 18px; background-color: black; display: inline-block; vertical-align: middle; animation: blink 1s step-end infinite;'></span>";
      } else {
        const userName = cursor.username || "User";
        cursorHTML = `<span class='other-cursor' style='position: relative; width: 2px; height: 18px; background-color: ${cursor.color}; display: inline-block; vertical-align: middle;'>
  <span style='position: absolute; top: -18px; left: -2px; background-color: ${cursor.color}; color: white; font-size: 0.7rem; padding: 0px 3px; border-radius: 2px; white-space: nowrap; opacity: 1;'>${userName}</span>
</span>`;
      }

      result = result.slice(0, position) + cursorHTML + result.slice(position);
    }

    return result;
  }

  findPositionFromCoordinates(
    x: number,
    y: number,
    fontInfo: { width: number; height: number }
  ): number {
    const text = this.getRawText();

    const lineIndex = Math.floor(y / fontInfo.height);

    // Ensure valid line index
    if (lineIndex >= this.lineStartPositions.length) {
      return text.length; // End of document
    }

    // Get line start position
    const lineStart = this.lineStartPositions[lineIndex];

    // Calculate approximate character position within line
    const charInLine = Math.floor(x / fontInfo.width);

    // Find end of line
    let lineEnd;
    if (lineIndex < this.lineStartPositions.length - 1) {
      lineEnd = this.lineStartPositions[lineIndex + 1] - 1; // -1 for newline
    } else {
      lineEnd = text.length;
    }

    // Constrain position to valid range
    return Math.min(lineStart + charInLine, lineEnd);
  }

  moveCursorUp(): void {
    // Find current line
    let currentLineIndex = 0;
    for (let i = 0; i < this.lineStartPositions.length; i++) {
      if (
        this.lineStartPositions[i] <= this.cursor_position &&
        (i === this.lineStartPositions.length - 1 ||
          this.lineStartPositions[i + 1] > this.cursor_position)
      ) {
        currentLineIndex = i;
        break;
      }
    }

    // If already at first line, move to beginning
    if (currentLineIndex === 0) {
      this.cursor_position = 0;
      return;
    }

    // Calculate horizontal offset in current line
    const currentLineOffset =
      this.cursor_position - this.lineStartPositions[currentLineIndex];

    // Move to previous line at same horizontal offset if possible
    const targetLineIndex = currentLineIndex - 1;
    const targetLineStart = this.lineStartPositions[targetLineIndex];
    const targetLineWidth = this.lineWidths[targetLineIndex];

    // Clamp horizontal position to line width
    const targetOffset = Math.min(currentLineOffset, targetLineWidth - 1);
    this.cursor_position = targetLineStart + targetOffset;
  }

  // Move cursor down one line
  moveCursorDown(): void {
    // Find current line
    let currentLineIndex = 0;
    for (let i = 0; i < this.lineStartPositions.length; i++) {
      if (
        this.lineStartPositions[i] <= this.cursor_position &&
        (i === this.lineStartPositions.length - 1 ||
          this.lineStartPositions[i + 1] > this.cursor_position)
      ) {
        currentLineIndex = i;
        break;
      }
    }

    // If already at last line, move to end
    if (currentLineIndex === this.lineStartPositions.length - 1) {
      this.cursor_position = this.getRawText().length;
      return;
    }

    // Calculate horizontal offset in current line
    const currentLineOffset =
      this.cursor_position - this.lineStartPositions[currentLineIndex];

    // Move to next line at same horizontal offset if possible
    const targetLineIndex = currentLineIndex + 1;
    const targetLineStart = this.lineStartPositions[targetLineIndex];
    const targetLineWidth = this.lineWidths[targetLineIndex];

    // Clamp horizontal position to line width
    const targetOffset = Math.min(currentLineOffset, targetLineWidth - 1);
    this.cursor_position = targetLineStart + targetOffset;
  }

  getCursorPosition(): number {
    return this.cursor_position;
  }

  setCursorPosition(pos: number): void {
    this.cursor_position = Math.max(0, Math.min(pos, this.getRawText().length));
  }
}
