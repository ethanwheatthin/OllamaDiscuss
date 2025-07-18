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
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
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
    
    for (let i = 0; i < 10 && !this.stopGeneration; i++) {
      const response = await this.generateResponse(currentModelName, currentPrompt);
      if (!response || this.stopGeneration) break;
      
      currentPrompt = `You are ${otherModelName}. Your partner in this discussion, ${currentModelName}, said: "${response}". Please respond directly to their statement, keeping the conversation going. Be concise.`;

      // Swap models for the next turn
      [currentModelName, otherModelName] = [otherModelName, currentModelName];
    }
    this.isGenerating.set(false);
  }


  generateResponse(model: string, prompt: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const thinkingMessage: Message = { author: model, content: '', isThinking: true };
      this.messages.update(msgs => [...msgs, thinkingMessage]);

      let fullResponse = '';
      let displayedResponse = '';
      const context = this.conversationContext[model] || [];

      this.ollama.generate(model, prompt, context).subscribe({
        next: (chunk: OllamaGenerateResponse) => {
          if (this.stopGeneration) return;

          fullResponse += chunk.response;
          
          // If chunk is done, start the typewriter effect
          if (chunk.done) {
            this.conversationContext[model] = chunk.context || [];
            let charIndex = 0;
            
            // Create a typing effect with a delay
            const typeText = () => {
              if (this.stopGeneration) {
                displayedResponse = fullResponse;
                return;
              }

              if (charIndex < fullResponse.length) {
                displayedResponse += fullResponse[charIndex];
                this.messages.update(msgs => {
                  msgs[msgs.length - 1].content = displayedResponse;
                  return [...msgs];
                });
                charIndex++;
                // Adjust the timeout value to control the typing speed (currently 25ms per character)
                setTimeout(typeText, 15);
              } else {
                // Finished typing
                this.messages.update(msgs => {
                  msgs[msgs.length - 1].isThinking = false;
                  return [...msgs];
                });
                resolve(fullResponse);
              }
            };

            typeText();
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
    window.location.reload(); // Reload the page to reset the discussion
  }
}