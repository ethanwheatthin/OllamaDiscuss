import { Component, EventEmitter, Output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OllamaService,
  OllamaModel,
} from '../../services/ollama.service';

// Interface for the data emitted when starting a discussion
export interface DiscussionConfig {
  topic: string;
  model1: string;
  model2: string;
  conversationStyle: string;
  rounds: number; // Number of conversation rounds
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  @Output() discussionStarted = new EventEmitter<DiscussionConfig>();
  
  models = signal<OllamaModel[]>([]);
  connectionStatus = signal<'pending' | 'connected' | 'disconnected'>('pending');
  validationError = signal<string>('');
  
  topic: string = 'The future of AI';
  model1: string = '';
  model2: string = '';
  rounds: number = 10; // Default value
  conversationStyle: string = 'formal'; // Default value
  constructor(private ollama: OllamaService) {}
  
  ngOnInit() {
    this.testConnectionAndFetchModels();
  }

  async testConnectionAndFetchModels() {
    this.connectionStatus.set('pending');
    const isConnected = await this.ollama.checkConnection();
    if (isConnected) {
      this.connectionStatus.set('connected');
      const fetchedModels = await this.ollama.getModels();
      this.models.set(fetchedModels);
      if (fetchedModels.length >= 2) {
        this.model1 = fetchedModels[0].id;
        this.model2 = fetchedModels[1].id;
      } else if (fetchedModels.length === 1) {
        this.model1 = fetchedModels[0].id;
      }
    } else {
      this.connectionStatus.set('disconnected');
    }
  }

  isFormValid(): boolean {
    if (!this.topic.trim()) return false;
    if (!this.model1 || !this.model2) return false;
    return this.connectionStatus() === 'connected';
  }

  decrementRounds(){
    this.rounds -= 1;
  }

  incrementRounds(){
    this.rounds += 1;
  }

  startDiscussion() {
    if (this.model1 === this.model2) {
      this.validationError.set('Please select two different models.');
      return;
    }
    if (!this.isFormValid()) {
        this.validationError.set('Please fill out all fields and ensure Ollama is connected.');
        return;
    }
    this.validationError.set('');
    this.discussionStarted.emit({
      topic: this.topic,
      model1: this.model1,
      model2: this.model2,
      conversationStyle: this.conversationStyle,
      rounds: this.rounds 
    });
  }
}