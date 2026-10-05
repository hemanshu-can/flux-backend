import { Body, Controller, Post } from 'routing-controllers';
import { Service } from 'typedi';

import { ChatbotService } from '../services/ChatbotService';
import type { ChatbotRequest, ChatbotResponse } from '../types/ai';

/**
 * Chatbot endpoint under /api/v1/chatbot.
 *
 * POST /api/v1/chatbot -> send the conversation so far, get the assistant's reply
 *
 * The conversation is stateless: the client keeps the transcript and sends it
 * back with every request. HTTP concerns only; the model loop lives in
 * ChatbotService.
 */
@Controller('/api/v1/chatbot')
@Service()
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post()
  chat(@Body({ required: true }) body: ChatbotRequest): Promise<ChatbotResponse> {
    return this.chatbotService.chat(body);
  }
}
