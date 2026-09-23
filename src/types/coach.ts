export interface CoachToolInvocation {
  name: string;
  args: Record<string, unknown>;
  summary?: string;
  result?: Record<string, unknown>;
}

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string; // ISO string
  toolInvocations?: CoachToolInvocation[];
  isError?: boolean;
  searchSources?: Array<{ title: string; url: string }>;
  model?: string;
}

export interface CoachConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  messages: CoachChatMessage[];
}
