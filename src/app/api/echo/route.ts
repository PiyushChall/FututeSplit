import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { history, goal, personality, gender } = await req.json(); // history: [{ sender: 'user'|'ai', text: string }]
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not set.' }, { status: 500 });
  }

  // Strongly contrasting system prompts
  const genderText = gender ? ` The user is a ${gender}.` : '';
  const systemPromptSuccess = `You are the user's future self who has SUCCEEDED in their main life goal: "${goal}". The user describes themselves as: "${personality}".${genderText} Respond ONLY as their successful future self. Give positive, strategic, and careful advice that leads to achieving the goal. Share what worked, what you avoided, and how you stayed focused. Be optimistic, but realistic. Keep your response concise and do not exceed 200 words. If needed, summarize or split your advice into shorter parts.`;
  const systemPromptFailure = `You are the user's future self who has failed to achieve their main life goal: '${goal}', based on their current description: '${personality}'. ${genderText} Respond only as this failed future self, speaking with regret, brutal honesty, and reflection. Share specific mistakes, missed opportunities, self-sabotaging actions, and moments of giving up or distraction, offering raw advice on what you wish you had done differently, without offering hope or positivity. Keep your response concise and do not exceed 200 words. If needed, summarize or split your advice into shorter parts.`;

  // Format messages for Gemini (prepend system prompt)
  function formatMessages(systemPrompt: string) {
    return [
      { role: 'model', parts: [{ text: systemPrompt }] },
      ...history.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })),
    ];
  }

  // Gemini 2.0 Flash endpoint
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  async function getPersonaResponse(systemPrompt: string) {
    const body = {
      contents: formatMessages(systemPrompt),
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 256
      }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
  }

  try {
    const [successText, failureText] = await Promise.all([
      getPersonaResponse(systemPromptSuccess),
      getPersonaResponse(systemPromptFailure),
    ]);
    return NextResponse.json({ successText, failureText });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch from Gemini.' }, { status: 500 });
  }
} 