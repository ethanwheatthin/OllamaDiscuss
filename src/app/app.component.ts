import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsComponent, DiscussionConfig } from './components/settings/settings.component';
import { ChatComponent } from './components/chat/chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SettingsComponent, ChatComponent],
  template: `
    <main>
      @if(discussionConfig()){
        <app-chat [config]="discussionConfig()!" />
      } @else {
        <app-settings (discussionStarted)="onDiscussionStart($event)" />
      }
    </main>
  `,
  styles: [`
    main {
      height: 100vh;
      width: 100vw;
      background-color: #212529;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    }
  `]
})
export class AppComponent {
  discussionConfig = signal<DiscussionConfig | null>(null);

  onDiscussionStart(config: DiscussionConfig) {
    this.discussionConfig.set(config);
  }
}