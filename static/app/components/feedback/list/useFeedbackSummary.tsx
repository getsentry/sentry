import {useEffect, useMemo, useRef, useState} from 'react';

import useFeedbackMessages from 'sentry/components/feedback/list/useFeedbackMessages';
import useOpenAIKey from 'sentry/components/feedback/list/useOpenAIKey';

export type Sentiment = {
  type: 'positive' | 'negative' | 'neutral';
  value: string;
};

const SUMMARY_REGEX = /Summary:(.*?)Key sentiments:/s;
const SENTIMENT_REGEX = /- (.*?):\s*(positive|negative|neutral)/gi;

async function getSentimentSummary({
  messages,
  apiKey,
}: {
  apiKey: string;
  messages: string[];
}) {
  const inputText = messages.map(msg => `- ${msg}`).join('\n');
  const prompt = `
You are an AI assistant that analyzes customer feedback. Below is a list of user messages.

${inputText}

Figure out the top 4 specific sentiments in the messages. Be concise but also specific in the summary.

The summary should be at most 2 sentences, and complete the sentence "Users say...".

After the summary, for each sentiment, also indicate if it is mostly positive or negative.

The output format should be:

Summary: <1-2 sentence summary>
Key sentiments:
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: prompt}],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

export default function useFeedbackSummary(): {
  error: Error | null;
  keySentiments: Sentiment[];
  loading: boolean;
  summary: string | null;
} {
  const apiKey = useOpenAIKey();
  const messages = useFeedbackMessages();

  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestMadeRef = useRef(false);

  const finalResultRef = useRef<{
    keySentiments: Sentiment[];
    summary: string | null;
  }>({
    summary: null,
    keySentiments: [],
  });

  useEffect(() => {
    if (!apiKey || !messages.length || requestMadeRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    requestMadeRef.current = true;

    getSentimentSummary({messages, apiKey})
      .then(result => {
        setResponse(result);
      })
      .catch(err => {
        setError(
          err instanceof Error ? err : new Error('Failed to get sentiment summary')
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey, messages]);

  const parsedResults = useMemo(() => {
    if (!response) {
      return finalResultRef.current;
    }

    let summaryText: string | null = null;
    const parsedSentiments: Sentiment[] = [];
    const summaryMatch = response.match(SUMMARY_REGEX);

    if (summaryMatch?.[1]) {
      summaryText = summaryMatch[1].trim();
    }

    SENTIMENT_REGEX.lastIndex = 0;
    let match = SENTIMENT_REGEX.exec(response);
    while (match !== null) {
      if (match[1] && match[2]) {
        const value = match[1].trim();
        const type = match[2].toLowerCase() as 'positive' | 'negative' | 'neutral';
        parsedSentiments.push({value, type});
      }
      match = SENTIMENT_REGEX.exec(response);
    }

    finalResultRef.current = {
      summary: summaryText,
      keySentiments: parsedSentiments,
    };

    return finalResultRef.current;
  }, [response]);

  if (loading) {
    return {
      summary: null,
      keySentiments: [],
      loading: true,
      error: null,
    };
  }

  if (error) {
    return {
      summary: null,
      keySentiments: [],
      loading: false,
      error,
    };
  }

  return {
    summary: parsedResults.summary,
    keySentiments: parsedResults.keySentiments,
    loading: false,
    error: null,
  };
}
