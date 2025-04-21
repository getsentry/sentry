import {useEffect, useMemo, useRef, useState} from 'react';

import useFeedbackMessages from 'sentry/components/feedback/list/useFeedbackMessages';
import useOpenAIKey from 'sentry/components/feedback/list/useOpenAIKey';

const KEYWORD_REGEX = /Keyword:(.*)/;

async function getSentimentSearchKeyword({
  messages,
  apiKey,
  sentiment,
}: {
  apiKey: string;
  messages: string[];
  sentiment: string;
}) {
  const inputText = messages.map(msg => `- ${msg}`).join('\n');
  const prompt = `
You are an AI assistant that analyzes customer feedback. Below is a list of user messages.

${inputText}

This is the sentiment we are looking for: ${sentiment}

Find the messages that are most related to the sentiment, and return one keyword such that a search for that keyword returns the most relevant messages. The keyword should be present in at least one of the messages.

The output format should be:

Keyword: <keyword>
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

export default function useSentimentKeyword({sentiment}: {sentiment: string | null}): {
  error: Error | null;
  keyword: string | null;
  loading: boolean;
} {
  const apiKey = useOpenAIKey();
  const messages = useFeedbackMessages();

  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestMadeRef = useRef(false);
  const previousSentimentRef = useRef<string | null>(null);

  const finalResultRef = useRef<{
    keyword: string | null;
  }>({
    keyword: null,
  });

  // Reset request ref when sentiment changes to a different value
  useEffect(() => {
    if (sentiment !== previousSentimentRef.current) {
      requestMadeRef.current = false;
      previousSentimentRef.current = sentiment;
    }
  }, [sentiment]);

  useEffect(() => {
    if (!apiKey || !messages.length || requestMadeRef.current || !sentiment) {
      return;
    }

    setLoading(true);
    setError(null);
    requestMadeRef.current = true;

    getSentimentSearchKeyword({messages, apiKey, sentiment})
      .then(result => {
        setResponse(result);
      })
      .catch(err => {
        setError(
          err instanceof Error ? err : new Error('Failed to get sentiment keyword')
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey, messages, sentiment]);

  const parsedResults = useMemo(() => {
    if (!response) {
      return finalResultRef.current;
    }

    let keyword: string | null = null;
    const keywordMatch = response.match(KEYWORD_REGEX);

    if (keywordMatch?.[1]) {
      keyword = keywordMatch[1].trim();
    }

    finalResultRef.current = {
      keyword,
    };

    return finalResultRef.current;
  }, [response]);

  if (loading) {
    return {
      keyword: null,
      loading: true,
      error: null,
    };
  }

  if (error) {
    return {
      keyword: null,
      loading: false,
      error,
    };
  }

  return {
    keyword: parsedResults.keyword,
    loading: false,
    error: null,
  };
}
