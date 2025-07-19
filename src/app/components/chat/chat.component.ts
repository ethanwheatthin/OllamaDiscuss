import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OllamaService, OllamaGenerateResponse } from '../../services/ollama.service';
import { DiscussionConfig } from '../settings/settings.component';
import { MarkdownModule } from 'ngx-markdown';


export interface Message {
  author: string;
  content: string;
  context?: number[];
  isThinking: boolean;
  isReasoningModel?: boolean;
  thoughtProcess?: string;
  contextSize?: number; // Add this line
}

// Add this interface near your other interfaces
interface ConversationStylePrompt {
  style: string;
  systemPrompt: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
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
// Add this as a class property
private conversationStyles: ConversationStylePrompt[] = [
  {
    style: 'formal',
    systemPrompt: 'Engage in a natural, balanced discussion while being concise and clear.'
  },
  {
    style: 'debate',
    systemPrompt: 'Engage in a formal debate style, presenting clear arguments and counterarguments'
  },
  {
    style: 'analytical',
    systemPrompt: 'Analyze topics systematically, break down arguments into components, and focus on evidence-based reasoning.'
  },
  {
    style: 'creative',
    systemPrompt: 'Explore unconventional perspectives, generate innovative ideas, and think outside traditional boundaries.'
  },
  {
    style: 'socratic',
    systemPrompt: 'Use questioning techniques to explore topics, challenge assumptions, and guide the discussion through inquiry.'
  },
  {
    style: 'adversarial',
    systemPrompt: 'Take strong opposing viewpoints to stress-test arguments while maintaining intellectual rigor.'
  },
  {
    style: 'storytelling',
    systemPrompt: 'Frame discussions through narratives, examples, and analogies to illustrate points effectively.'
  }
];
  constructor(private ollama: OllamaService) { }

  ngOnInit() {
    this.startConversation();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const element = this.messageListContainer.nativeElement;
      const threshold = 70; // Adjust this value as needed
      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

      if (distanceToBottom <= threshold) {
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) { }
  }
  async startConversation() {
    // this.stopGeneration = false;
    this.isGenerating.set(true);

    let currentModelName = this.config.model1;
    let otherModelName = this.config.model2;
    
    // Get the system prompt for the selected conversation style
    const stylePrompt = this.conversationStyles.find(s => s.style === this.config.conversationStyle)?.systemPrompt || 
                       this.conversationStyles[0].systemPrompt;

    let currentPrompt = `${stylePrompt} Start a discussion about the following topic: "${this.config.topic}". Please provide an opening statement.`;

    for (let i = 0; i < this.config.rounds && !this.stopGeneration; i++) {
      const response = await this.generateResponse(currentModelName, currentPrompt);
      if (this.stopGeneration) break;

      currentPrompt = `${stylePrompt} You are ${otherModelName}. Your partner in this discussion, ${currentModelName}, said: "${response}". Please respond directly to their statement, keeping the conversation going.`;
      console.log(`Round ${i + 1}: ${currentPrompt}"`);
      // Swap models for the next turn
      [currentModelName, otherModelName] = [otherModelName, currentModelName];
    }
    this.isGenerating.set(false);
}


  private processReasoningResponse(response: string): { content: string, thoughtProcess?: string } {
    const thinkMatch = response.match(/<think>(.*?)<\/think>/s);
    const thoughtProcess = thinkMatch ? thinkMatch[1].trim() : undefined;
    const cleanContent = response.replace(/<think>.*?<\/think>/s, '').trim();

    return {
      content: cleanContent,
      thoughtProcess: thoughtProcess
    };
  }

  generateResponse(model: string, prompt: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      let isReasoningModel = false
      const thinkingMessage: Message = {
        author: model,
        content: '',
        isThinking: true,
        isReasoningModel,
        contextSize: 0
      };
      this.messages.update(msgs => [...msgs, thinkingMessage]);

      let fullResponse = '';
      let displayedResponse = '';
      let displayedThoughtProcess = ''; // To hold the displayed thought process
      const context = this.conversationContext[model] || [];

      this.ollama.generate(model, prompt, context).subscribe({
        next: (chunk: OllamaGenerateResponse) => {
          if (this.stopGeneration) return;
          
          fullResponse += chunk.response;

          if (chunk.done) {

            this.conversationContext[model] = chunk.context || [];
            let charIndex = 0;
            let thoughtProcessCharIndex = 0; // Index for typing the thought process
               if(/<think>/i.test(fullResponse)){
                isReasoningModel = true;
                thinkingMessage.isReasoningModel = true;
              }
            // Process reasoning model response if applicable
            const processedResponse = isReasoningModel
              ? this.processReasoningResponse(fullResponse)
              : { content: fullResponse };

            // Function to type out the thought process
            const typeThoughtProcess = () => {
              if (this.stopGeneration) {
                displayedThoughtProcess = processedResponse.thoughtProcess || '';
                return;
              }

              if (processedResponse.thoughtProcess && thoughtProcessCharIndex < processedResponse.thoughtProcess.length) {
                displayedThoughtProcess += processedResponse.thoughtProcess[thoughtProcessCharIndex];
                this.messages.update(msgs => {
                  const updatedMsgs = [...msgs];
                  updatedMsgs[updatedMsgs.length - 1].thoughtProcess = displayedThoughtProcess;
                  return updatedMsgs;
                });
                thoughtProcessCharIndex++;
                setTimeout(typeThoughtProcess, 5);
              } else {
                // After typing the thought process, start typing the content
                typeText();
              }
            };

            const typeText = () => {
              if (this.stopGeneration) {
                displayedResponse = processedResponse.content;
                return;
              }

              if (charIndex < processedResponse.content.length) {
                displayedResponse += processedResponse.content[charIndex];
                this.messages.update(msgs => {
                  const updatedMsgs = [...msgs];
                  updatedMsgs[updatedMsgs.length - 1].content = displayedResponse;
                  updatedMsgs[updatedMsgs.length - 1].contextSize = chunk.context?.length;
                  return updatedMsgs;
                });
                charIndex++;
                setTimeout(typeText, 5);
              } else {
                this.messages.update(msgs => {
                  const updatedMsgs = [...msgs];
                  updatedMsgs[updatedMsgs.length - 1].isThinking = false;
                   return updatedMsgs;
                });
                resolve(processedResponse.content); // Pass only the clean content to the next model
              }
            };

            if (isReasoningModel && processedResponse.thoughtProcess) {
              typeThoughtProcess(); // Start typing the thought process first
            } else {
              typeText(); // If no thought process, type the content directly
            }
          }
        },
      });
    });
  }


  stopDiscussion() {
    this.stopGeneration = true;
    this.isGenerating.set(false);
    window.location.reload(); // Reload the page to reset the discussion
  }
}