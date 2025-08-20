import {type ReactNode} from 'react';
import {ClassNames} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout/flex';
import {Hovercard} from 'sentry/components/hovercard';
import ReplayCrumbList from 'sentry/components/replays/selectors/replaySelectorsList';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import type {UIClickAction} from 'sentry/utils/replays/assertions/types';
import useOrganization from 'sentry/utils/useOrganization';
import type {DeadRageSelectorListResponse} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  onActionSubmit: (action: UIClickAction) => void;
  projectId: string;
}

export default function UIClickActionEditor({
  children,
  projectId,
  onActionSubmit,
}: Props) {
  const organization = useOrganization();

  const queryResult = useInfiniteApiQuery<DeadRageSelectorListResponse>({
    queryKey: [
      'infinite',
      `/organizations/${organization.slug}/replay-selectors/`,
      {
        query: {
          per_page: 50,
          project: projectId,
          statsPeriod: '90d',
        },
      },
    ],
  });

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <Flex style={{height: 500}}>
              <Flex direction="column" gap="md" flex="1">
                <ReplayCrumbList
                  onSelect={selected => {
                    onActionSubmit({
                      category: 'ui.click',
                      matcher: {
                        dom_element: selected.dom_element,
                      },
                      type: 'breadcrumb',
                    });
                  }}
                  queryResult={queryResult}
                />
              </Flex>
            </Flex>
          }
          className={css`
            height: 500px;
            width: 500px;
          `}
        >
          {children}
        </Hovercard>
      )}
    </ClassNames>
  );
}
