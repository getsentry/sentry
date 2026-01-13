import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout/flex';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkInvite,
  type ConsoleSdkInviteUser,
} from 'sentry/views/settings/organizationConsoleSdkInvites/hooks';

interface ToggleConsolePlatformsModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ToggleConsolePlatformsModal({
  Header,
  Body,
  closeModal,
  organization,
  onSuccess,
}: ToggleConsolePlatformsModalProps) {
  const {enabledConsolePlatforms = [], consoleSdkInviteQuota = 0} = organization;

  const {data: userIdentities, isPending: isInvitesFetchPending} = useConsoleSdkInvites(
    organization.slug
  );
  const {
    mutate: revokeConsoleInvite,
    isPending: isRevokePending,
    variables: revokeVariables,
  } = useRevokeConsoleSdkInvite();
  const {isPending: isUpdatePending, mutate: updateConsolePlatforms} = useMutation({
    mutationFn: (data: Record<string, boolean | number>) => {
      const {newConsoleSdkInviteQuota, ...platforms} = data;
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {
          enabledConsolePlatforms: Object.keys(platforms).reduce((acc, key) => {
            if (platforms[key]) {
              acc.push(key);
            }
            return acc;
          }, [] as string[]),
          consoleSdkInviteQuota: newConsoleSdkInviteQuota,
        },
      });
    },
    onMutate: () => {
      addLoadingMessage(`Updating console platforms for ${organization.slug}\u2026`);
    },
    onSuccess: () => {
      addSuccessMessage(`Console platforms updated for ${organization.slug}`);
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage(`Failed to update console platforms for ${organization.slug}`);
    },
  });

  return (
    <Form
      onSubmit={data => updateConsolePlatforms(data as Record<string, boolean | number>)}
      onCancel={closeModal}
      saveOnBlur={false}
      initialData={{
        playstation: enabledConsolePlatforms.includes('playstation'),
        'nintendo-switch': enabledConsolePlatforms.includes('nintendo-switch'),
        xbox: enabledConsolePlatforms.includes('xbox'),
        newConsoleSdkInviteQuota: consoleSdkInviteQuota,
      }}
      submitLabel="Save"
      submitDisabled={isUpdatePending}
    >
      <Header closeButton>
        <Flex align="center" gap="xl">
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
              label: 'PlayStation',
              help: 'Toggle the PlayStation console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <StyledFieldFromConfig
            field={{
              name: 'nintendo-switch',
              type: 'boolean',
              label: 'Nintendo Switch',
              help: 'Toggle Nintendo Switch console platform for this organization.',
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
          <NumberFieldFromConfig
            field={{
              name: 'newConsoleSdkInviteQuota',
              type: 'number',
              label: 'GitHub Repo Invite Limit',
              help: `Set the maximum number of GitHub users that can be invited to our console SDK repositories. Currently ${userIdentities?.length ?? 0} of ${consoleSdkInviteQuota} invites used.`,
              min: 0,
            }}
            flexibleControlStateSize
            inline
          />
        </div>

        <SimpleTableWithColumns>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>Email</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>Platforms</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {isInvitesFetchPending && (
            <SimpleTable.Empty>
              <LoadingIndicator />
            </SimpleTable.Empty>
          )}

          {!isInvitesFetchPending &&
            (userIdentities === undefined || userIdentities.length === 0) && (
              <SimpleTable.Empty>No invites found</SimpleTable.Empty>
            )}

          {(userIdentities ?? []).map(
            ({email, platforms, user_id}: ConsoleSdkInviteUser) => (
              <SimpleTable.Row key={user_id}>
                <SimpleTable.RowCell>
                  <Link to={`/_admin/users/${user_id}`}>{email}</Link>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Flex gap="sm">
                    {platforms.map(platform => {
                      const isPlatformRevoking =
                        isRevokePending &&
                        revokeVariables?.userId === user_id &&
                        revokeVariables?.platforms?.includes(platform);

                      return (
                        <Tag
                          key={platform}
                          variant="muted"
                          onDismiss={
                            isPlatformRevoking
                              ? undefined
                              : () => {
                                  revokeConsoleInvite({
                                    userId: user_id,
                                    email,
                                    platforms: [platform],
                                    orgSlug: organization.slug,
                                  });
                                }
                          }
                        >
                          {platform}
                        </Tag>
                      );
                    })}
                  </Flex>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            )
          )}
        </SimpleTableWithColumns>
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

const NumberFieldFromConfig = styled(FieldFromConfig)`
  padding-left: ${space(4)};
  > div {
    padding-right: ${space(4)};
  }
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 2fr max-content;
`;

export function openToggleConsolePlatformsModal({
  organization,
  onSuccess,
}: {
  onSuccess: () => void;
  organization: Organization;
}) {
  return openModal(deps => (
    <ToggleConsolePlatformsModal
      {...deps}
      organization={organization}
      onSuccess={onSuccess}
    />
  ));
}
