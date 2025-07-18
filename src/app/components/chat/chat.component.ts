import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OllamaService, OllamaGenerateResponse } from '../../services/ollama.service';
import { DiscussionConfig } from '../settings/settings.component';

export interface Message {
  author: string;
  content: string;
  context?: number[];
  isThinking: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-container">
      <h2>Discussion: {{ config.topic }}</h2>
      <div class="message-list" #messageList>
        @for(msg of messages(); track $index) {
          <div class="message" [class.model-1]="msg.author === config.model1" [class.model-2]="msg.author === config.model2">
            <div class="author">{{ msg.author }}</div>
            <div class="content">
              <p>{{ msg.content }}</p>
              @if(msg.isThinking) {
                <div class="thinking-indicator"></div>
              }
            </div>
          </div>
        }
      </div>
      <button (click)="stopDiscussion()">Stop Generation</button>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .chat-container { display: flex; flex-direction: column; height: 100%; max-width: 800px; margin: auto; background: #282c34; border-radius: 8px; padding: 1rem; }
    h2 { text-align: center; color: #61dafb; margin: 0 0 1rem 0; }
    .message-list { flex-grow: 1; overflow-y: auto; padding: 0 1rem; ::-webkit-scrollbar {
    display: none;
} }
    .message { margin-bottom: 1rem; max-width: 80%; display: flex; flex-direction: column; }
    .author { font-weight: bold; margin-bottom: 0.25rem; font-size: 0.8rem; opacity: 0.7; }
    .content { padding: 0.75rem 1rem; border-radius: 18px; color: #fff; }
    p { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .model-1 { align-self: flex-start; }
    .model-1 .author { color: #61dafb; }
    .model-1 .content { background: #3a3f47; border-top-left-radius: 4px; }
    .model-2 { align-self: flex-end; }
    .model-2 .author { color: #98c379; text-align: right; }
    .model-2 .content { background: #4f5661; border-top-right-radius: 4px; }
    .thinking-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #fff; margin-left: 8px; animation: blink 1.4s infinite both; }
    @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; background: #dc3545; color: white; cursor: pointer; margin-top: 1rem; align-self: center; }
    button:disabled { background: #555; cursor: not-allowed; }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @Input({ required: true }) config!: DiscussionConfig;
  @ViewChild('messageList') private messageListContainer!: ElementRef;

  messages = signal<Message[]>([]);
  isGenerating = signal<boolean>(false);
  private stopGeneration = false;
  private conversationContext: { [key: string]: number[] } = {};

  constructor(private ollama: OllamaService) {}

  ngOnInit() {
    this.startConversation();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messageListContainer.nativeElement.scrollTop = this.messageListContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  async startConversation() {
    this.stopGeneration = false;
    this.isGenerating.set(true);

    let currentModelName = this.config.model1;
    let otherModelName = this.config.model2;
    let currentPrompt = `Start a discussion about the following topic: "${this.config.topic}". Please provide a concise opening statement.`;
    
    // Limit the conversation to 5 turns
    for (let i = 0; i < 10 && !this.stopGeneration; i++) {
      const response = await this.generateResponse(currentModelName, currentPrompt);
      if (!response || this.stopGeneration) break;
      
      currentPrompt = `Your partner in this discussion, ${currentModelName}, said: "${response}". Please respond directly to their statement, keeping the conversation going. Be concise.`;

      // Swap models for the next turn
      [currentModelName, otherModelName] = [otherModelName, currentModelName];
    }
    this.isGenerating.set(false);
  }

  generateResponse(model: string, prompt: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      // Add a "thinking" message
      const thinkingMessage: Message = { author: model, content: '', isThinking: true };
      this.messages.update(msgs => [...msgs, thinkingMessage]);

      let fullResponse = '';
      const context = this.conversationContext[model] || [];

      this.ollama.generate(model, prompt, context).subscribe({
        next: (chunk: OllamaGenerateResponse) => {
          if (this.stopGeneration) return;

          fullResponse += chunk.response;
          // Update the last message in the signal with the new content
          this.messages.update(msgs => {
            msgs[msgs.length - 1].content = fullResponse;
            return [...msgs];
          });

          if (chunk.done) {
            this.conversationContext[model] = chunk.context || []; // Save context for this model
            this.messages.update(msgs => {
              msgs[msgs.length - 1].isThinking = false;
              return [...msgs];
            });
            resolve(fullResponse);
          }
        },
        error: (err) => {
          console.error(err);
          this.messages.update(msgs => {
              msgs[msgs.length - 1].content = `Error: ${err.message}`;
              msgs[msgs.length - 1].isThinking = false;
              return [...msgs];
          });
          this.isGenerating.set(false);
          reject(null);
        }
      });
    });
  }

  stopDiscussion() {
    this.stopGeneration = true;
    this.isGenerating.set(false);
    
  }
}