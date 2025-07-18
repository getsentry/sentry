import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/core/layout/flex';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

interface ToggleConsolePlatformsModalProps extends ModalRenderProps {
  organization: Organization;
}

export function ToggleConsolePlatformsModal({
  Header,
  Body,
  closeModal,
  organization,
}: ToggleConsolePlatformsModalProps) {
  const api = useApi();
  const {enabledConsolePlatforms = []} = organization;

  const {isPending, mutate: updateConsolePlatforms} = useMutation({
    mutationFn: (platforms: Record<string, boolean>) => {
      return api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {
          enabledConsolePlatforms: Object.keys(platforms).reduce((acc, key) => {
            if (platforms[key]) {
              acc.push(key);
            }
            return acc;
          }, [] as string[]),
        },
      });
    },
    onMutate: () => {
      addLoadingMessage('Updating console platforms\u2026');
    },
    onSuccess: () => {
      addSuccessMessage('Console platforms updated');
    },
    onError: () => {
      addErrorMessage('Failed to update console platforms');
    },
  });

  return (
    <Form
      onSubmit={data => updateConsolePlatforms(data as Record<string, boolean>)}
      onCancel={closeModal}
      saveOnBlur={false}
      initialData={{
        playstation: enabledConsolePlatforms.includes('playstation'),
        'nintendo-switch': enabledConsolePlatforms.includes('nintendo-switch'),
        xbox: enabledConsolePlatforms.includes('xbox'),
      }}
      submitLabel="Save"
      submitDisabled={isPending}
    >
      <Header closeButton>
        <Flex align="center" gap={space(2)}>
          <h4>Toggle Console Platforms</h4>
        </Flex>
      </Header>
      <Body>
        <p
          css={css`
            margin: 0;
          `}
        >
          Toggle consoles to allow users in this organization to create console projects
          and view private setup instructions.
        </p>
        <div
          css={css`
            margin: 0 -${space(4)};
          `}
        >
          <StyledFieldFromConfig
            field={{
              name: 'playstation',
              type: 'boolean',
              label: 'Playstation',
              help: 'Toggle the Playstation console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <StyledFieldFromConfig
            field={{
              name: 'nintendo-switch',
              type: 'boolean',
              label: 'Nintendo Switch',
              help: 'Toggle the Nintendo Switch console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <StyledFieldFromConfig
            field={{
              name: 'xbox',
              type: 'boolean',
              label: 'Xbox',
              help: 'Toggle the Xbox console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
        </div>
      </Body>
    </Form>
  );
}

const StyledFieldFromConfig = styled(FieldFromConfig)`
  padding-left: ${space(4)};
  &:last-child {
    padding-bottom: 0;
  }
`;

export function openToggleConsolePlatformsModal({
  organization,
}: {
  organization: Organization;
}) {
  return openModal(deps => (
    <ToggleConsolePlatformsModal {...deps} organization={organization} />
  ));
}
