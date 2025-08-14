import {useQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface ReplayPrompt {
  body: {
    logs: string[];
    num_segments: number;
    organization_id: string;
    project_id: string;
    replay_id: string;
  };
  signature: string;
}

export default function useReplayPrompt(
  replayRecord: ReplayRecord | undefined,
  logs: string[]
) {
  const {project: project_id} = useLocationQuery({
    fields: {project: decodeScalar},
  });
  const replay = useReplayReader();
  const project = useProjectFromId({project_id});
  const organization = useOrganization();
  const body = {
    logs,
    replay_id: replay?.getReplay().id ?? '',
    organization_id: organization.id,
    project_id: project?.id ?? '',
    num_segments: replay?.getReplay().count_segments ?? 0,
  };

  return useQuery<ReplayPrompt | null>({
    queryKey: ['replay-prompt', project?.id, replayRecord?.id, body],
    queryFn: async () => {
      try {
        const key = await window.crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode('seers-also-very-long-value-haha'),
          {name: 'HMAC', hash: {name: 'SHA-256'}},
          false,
          ['sign', 'verify']
        );
        const signature = await window.crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(JSON.stringify(body))
        );

        return {
          body,
          signature: Buffer.from(signature).toString('base64'),
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return null;
      }
    },
  });
}
