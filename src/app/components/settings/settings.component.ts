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
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <h2>Ollama Discussion Simulator</h2>
      
      <div class="connection">
        <span>Ollama Status:</span>
        @if(connectionStatus() === 'connected'){
          <span class="status-badge connected">Connected ✅</span>
        } @else if(connectionStatus() === 'disconnected'){
          <span class="status-badge disconnected">Disconnected ❌</span>
        } @else {
          <span class="status-badge pending">Checking...</span>
        }
      </div>

      <div class="form-group">
        <label for="topic">Discussion Topic:</label>
        <input id="topic" type="text" [(ngModel)]="topic" placeholder="e.g., The future of AI">
      </div>

      <div class="model-selectors">
        <div class="form-group">
          <label for="model1">Model 1</label>
          <select id="model1" [(ngModel)]="model1">
            @for(model of models(); track model.id){
              <option [value]="model.id">{{ model.id }}</option>
            }
          </select>
        </div>
        <div class="form-group">
          <label for="model2">Model 2</label>
          <select id="model2" [(ngModel)]="model2">
            @for(model of models(); track model.id){
              <option [value]="model.id">{{ model.id }}</option>
            }
          </select>
        </div>
      </div>
      
      <button (click)="startDiscussion()" [disabled]="!isFormValid()">Start Discussion</button>
      <p class="error-msg">{{ validationError() }}</p>
    </div>
  `,
  styles: [`
    .settings-container { max-width: 600px; margin: 2rem auto; padding: 2rem; background: #282c34; border-radius: 8px; }
    h2 { text-align: center; color: #61dafb; margin-bottom: 2rem; }
    .connection { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding: 0.5rem; background: #3c4049; border-radius: 4px; }
    .status-badge { padding: 0.3rem 0.6rem; border-radius: 12px; font-weight: bold; }
    .connected { background-color: #28a745; }
    .disconnected { background-color: #dc3545; }
    .pending { background-color: #ffc107; color: #212529; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; color: #abb2bf; }
    input, select { width: 100%; padding: 0.75rem; border-radius: 4px; border: 1px solid #4f5661; background: #212529; color: #fff; font-size: 1rem; }
    .model-selectors { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    button { width: 100%; padding: 0.8rem; font-size: 1.1rem; border: none; border-radius: 4px; background: #61dafb; color: #212529; cursor: pointer; transition: background-color 0.2s; }
    button:disabled { background: #555; cursor: not-allowed; }
    .error-msg { color: #ff6b6b; text-align: center; margin-top: 1rem; height: 1em; }
  `]
})
export class SettingsComponent implements OnInit {
  @Output() discussionStarted = new EventEmitter<DiscussionConfig>();
  
  models = signal<OllamaModel[]>([]);
  connectionStatus = signal<'pending' | 'connected' | 'disconnected'>('pending');
  validationError = signal<string>('');
  
  topic: string = 'The future of AI';
  model1: string = '';
  model2: string = '';

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
    });
  }
}