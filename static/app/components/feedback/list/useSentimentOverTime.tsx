import {useEffect, useMemo, useRef, useState} from 'react';

import useFeedbackMessages from 'sentry/components/feedback/list/useFeedbackMessages';
import useOpenAIKey from 'sentry/components/feedback/list/useOpenAIKey';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

async function getSentimentOverTime({
  messagesWithTime,
  apiKey,
}: {
  apiKey: string;
  messagesWithTime: Array<{message: string; time: string}>;
}) {
  const inputText = messagesWithTime.map(msg => `${msg.message}: ${msg.time}`).join('\n');
  const prompt = `
You are an AI assistant that analyzes customer feedback. Below is a list of user messages and the time they were sent.

${inputText}

For each day, output a number from 1 to 10 indcating how positive or negative the overall messages are on that day. 1 is most negative and 10 is most positive. Return each day as a unix timestamp.

The output format should be:
<day1>: <number>
<day2>: <number>
<day3>: <number>
...
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

export default function useSentimentOverTime(): {
  error: Error | null;
  loading: boolean;
  series: DiscoverSeries[];
} {
  const apiKey = useOpenAIKey();
  const {messagesWithTime} = useFeedbackMessages();

  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestMadeRef = useRef(false);

  const finalResultRef = useRef<{
    series: DiscoverSeries[];
  }>({
    series: [],
  });

  useEffect(() => {
    if (!apiKey || !messagesWithTime.length || requestMadeRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    requestMadeRef.current = true;

    getSentimentOverTime({messagesWithTime, apiKey})
      .then(result => {
        setResponse(result);
      })
      .catch(err => {
        setError(
          err instanceof Error ? err : new Error('Failed to get sentiment over time')
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey, messagesWithTime]);

  const parsedResults = useMemo(() => {
    if (!response) {
      return finalResultRef.current;
    }

    // parse response into a series
    const seriesData = response.split('\n').map(line => {
      const [day, score] = line.split(': ');
      return {
        name: day ?? '',
        value: parseInt(score ?? '1', 10),
      };
    });

    finalResultRef.current = {
      series: [
        {
          data: seriesData,
          seriesName: 'Sentiment Over Time',
          meta: {
            fields: {
              day: 'date',
              sentiment: 'integer',
            },
            units: {
              day: 'days',
            },
          },
        },
      ],
    };

    return finalResultRef.current;
  }, [response]);

  if (loading) {
    return {
      series: [],
      loading: true,
      error: null,
    };
  }

  if (error) {
    return {
      series: [],
      loading: false,
      error,
    };
  }

  return {
    series: parsedResults.series,
    loading: false,
    error: null,
  };
}
