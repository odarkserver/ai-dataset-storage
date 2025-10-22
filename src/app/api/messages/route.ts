import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, content } = await request.json();

    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: 'Session ID, role, and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either "user" or "assistant"' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await db.chatSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Save message
    const message = await db.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    });

    // Update session timestamp
    await db.chatSession.update({
      where: { sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    });
  } catch (error) {
    console.error('Message saving error:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}