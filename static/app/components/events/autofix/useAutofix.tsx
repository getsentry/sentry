import {useCallback, useState} from 'react';

import type {AutofixData, GroupWithAutofix} from 'sentry/components/events/autofix/types';
import type {Event} from 'sentry/types';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

export type AutofixResponse = {
  autofix: AutofixData | null;
};

const POLL_INTERVAL = 2500;

const ROOT_CAUSES_MOCK = [
  {
    id: '1',
    actionability: 1,
    description:
      "The root cause of the issue is that the 'function' field in the frame dictionary is None, which is not a valid string as expected by the StacktraceFrame model. This leads to a ValidationError when attempting to validate and append the frame to the stacktrace_frames list.",
    likelihood: 0.8,
    suggested_fixes: [
      {
        description:
          "To address this issue, the StacktraceFrame model should be modified to allow the 'function' field to be None and default it to a placeholder string (e.g., \"unknown_function\"). This change ensures that frames with a None 'function' field can still be processed without causing a ValidationError, while also making it clear that the original function name was not provided. This approach maintains data integrity and provides clarity in debugging scenarios.",
        elegance: 0.9,
        snippet: {
          file_path: 'seer/automation/autofix/models.py',
          snippet:
            'class StacktraceFrame(BaseModel):\n    function: Optional[str] = Field(default="unknown_function", alias=\'function\')\n    # Other fields...',
        },
        title:
          "Modify the StacktraceFrame model to allow the 'function' field to be None and provide a default value",
      },
    ],
    title:
      "The 'function' field in the frame dictionary is None, causing ValidationError",
  },
  {
    id: '2',
    actionability: 0.8,
    description:
      "Another potential cause is the absence of validation or preprocessing steps in the validate_frames function to handle None 'function' values before attempting to validate and create StacktraceFrame objects. This oversight leads to the direct passing of invalid data to the model, resulting in a ValidationError.",
    likelihood: 0.5,
    suggested_fixes: [
      {
        description:
          'Before attempting to validate and append frames to the stacktrace_frames list, implement a preprocessing step in the validate_frames function. This step should check for None \'function\' values and either skip the frame or replace the None value with a default string (e.g., "unknown_function"). This approach allows for more flexibility in handling invalid data and ensures that only valid frames are processed.',
        elegance: 0.8,
        snippet: {
          file_path: 'seer/automation/autofix/models.py',
          snippet:
            "def validate_frames(cls, frames: list[StacktraceFrame | SentryFrame]):\n    stacktrace_frames = []\n    for frame in frames:\n        if isinstance(frame, dict):\n            frame['function'] = frame.get('function', 'unknown_function')  # Preprocessing step\n            try:\n                stacktrace_frames.append(StacktraceFrame.model_validate(frame))\n            except ValidationError:\n                sentry_sdk.capture_exception()\n                continue\n        else:\n            stacktrace_frames.append(frame)",
        },
        title:
          "Implement preprocessing in the validate_frames function to handle None 'function' values",
      },
    ],
    title:
      "Lack of validation or preprocessing for None 'function' values before model validation",
  },
];

export const makeAutofixQueryKey = (groupId: string): ApiQueryKey => [
  `/issues/${groupId}/ai-autofix/`,
];

const isPolling = (autofixData?: AutofixData | null) =>
  autofixData?.status === 'PROCESSING';

export const useAiAutofix = (group: GroupWithAutofix, event: Event) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const [isReset, setIsReset] = useState<boolean>(false);

  const initialAutofixData: AutofixResponse['autofix'] = {
    status: 'NEED_MORE_INFORMATION',
    created_at: '',
    steps: [
      {
        index: 0,
        title: 'Root Cause Analysis',
        id: 'root_cause_analysis',
        status: 'COMPLETED',
        progress: [
          {
            timestamp: '2023-01-01T00:00:00Z',
            message: 'Analysis',
            type: 'NEED_MORE_INFORMATION',
            data: {
              causes: ROOT_CAUSES_MOCK,
            },
          },
        ],
      },
    ],
  };

  const {
    data: apiData,
    isError,
    error,
  } = useApiQuery<AutofixResponse>(makeAutofixQueryKey(group.id), {
    staleTime: Infinity,
    retry: false,
    initialData: [{autofix: initialAutofixData}, undefined, undefined],
    refetchInterval: data => {
      if (isPolling(data?.[0]?.autofix)) {
        return POLL_INTERVAL;
      }
      return false;
    },
    enabled: false, // TODO: Remove this when we have real data
  });

  const triggerAutofix = useCallback(
    async (instruction: string) => {
      setIsReset(false);
      setApiQueryData<AutofixResponse>(queryClient, makeAutofixQueryKey(group.id), {
        autofix: {
          status: 'PROCESSING',
          steps: [
            {
              id: '1',
              index: 0,
              status: 'PROCESSING',
              title: 'Starting Autofix...',
              progress: [],
            },
          ],
          created_at: new Date().toISOString(),
        },
      });

      try {
        await api.requestPromise(`/issues/${group.id}/ai-autofix/`, {
          method: 'POST',
          data: {
            event_id: event.id,
            instruction,
          },
        });
      } catch (e) {
        // Don't need to do anything, error should be in the metadata
      }
    },
    [queryClient, group.id, api, event.id]
  );

  const reset = useCallback(() => {
    setIsReset(true);
  }, []);

  const autofixData = apiData?.autofix;

  return {
    autofixData,
    error,
    isError,
    isPolling: isPolling(autofixData),
    triggerAutofix,
    reset,
  };
};
