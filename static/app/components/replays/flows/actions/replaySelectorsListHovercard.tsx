import {type ReactNode} from 'react';
import {ClassNames} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout/flex';
import {Hovercard} from 'sentry/components/hovercard';
import ReplaySelectorsList from 'sentry/components/replays/selectors/replaySelectorsList';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import type {UIClickAction} from 'sentry/utils/replays/assertions/types';
import useOrganization from 'sentry/utils/useOrganization';
import type {DeadRageSelectorListResponse} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
  onChange: (action: UIClickAction) => void;
  projectId: string;
  disabled?: boolean;
}

export default function ReplaySelectorsListHovercard({
  children,
  projectId,
  onChange,
  disabled = false,
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

  if (disabled) {
    return children;
  }

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <Flex style={{height: 480}}>
              <Flex direction="column" gap="md" flex="1">
                <ReplaySelectorsList
                  onSelect={selected => {
                    onChange({
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
