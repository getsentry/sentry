import {useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {
  CONSOLE_PLATFORM_METADATA,
  type ConsolePlatform,
} from 'sentry/constants/consolePlatforms';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkPlatformInvite,
  type ConsoleSdkInviteUser,
} from 'sentry/views/settings/organizationConsoleSdkInvites/hooks';

const INVITE_COLUMNS: TableColumnConfig[] = [
  {key: 'user', width: '1fr'},
  {key: 'platforms', width: '1fr'},
];

function QuotaAlert({
  playstation,
  nintendoSwitch,
  xbox,
  quota,
}: {
  nintendoSwitch: boolean;
  playstation: boolean;
  quota: number | null;
  xbox: boolean;
}) {
  const hasEnabledPlatform = playstation || nintendoSwitch || xbox;
  const isQuotaZero = Number(quota) === 0;

  if (!hasEnabledPlatform || !isQuotaZero) {
    return null;
  }

  return (
    <StyledQuotaAlert variant="warning">
      You have enabled console platforms but the invite quota is set to 0. Users won't be
      able to request access to the console SDK repositories anymore.
    </StyledQuotaAlert>
  );
}

interface InviteRowProps {
  invite: ConsoleSdkInviteUser;
  onRevoke: (params: {memberId: string; platform: ConsolePlatform}) => void;
}

function InviteRow({invite, onRevoke}: InviteRowProps) {
  const {email, platforms, userId, memberId} = invite;

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Link to={`/_admin/users/${userId}`}>
          <Text wordBreak="break-all">{email}</Text>
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex gap="sm" wrap="wrap">
          {platforms.map(platform => {
            const displayName =
              CONSOLE_PLATFORM_METADATA[platform]?.displayName ?? platform;

            return (
              <Tag
                key={platform}
                variant="info"
                onDismiss={() => onRevoke({memberId, platform})}
              >
                {displayName}
              </Tag>
            );
          })}
        </Flex>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

interface InvitesTableProps {
  invites: ConsoleSdkInviteUser[];
  isError: boolean;
  isPending: boolean;
  onRefetch: () => void;
  onRevoke: (params: {memberId: string; platform: ConsolePlatform}) => void;
}

function InvitesTableContent({
  invites,
  isPending,
  isError,
  onRefetch,
  onRevoke,
}: InvitesTableProps) {
  if (isPending) {
    return <SimpleTable.Loading />;
  }

  if (isError) {
    return <SimpleTable.Error onRetry={onRefetch} />;
  }

  if (invites.length === 0) {
    return <SimpleTable.Empty>No invites found</SimpleTable.Empty>;
  }

  return invites.map(invite => (
    <InviteRow key={invite.memberId} invite={invite} onRevoke={onRevoke} />
  ));
}

interface ToggleConsolePlatformsModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

const formSchema = z.object({
  playstation: z.boolean(),
  'nintendo-switch': z.boolean(),
  xbox: z.boolean(),
  newConsoleSdkInviteQuota: z.number().nullable(),
});

function ToggleConsolePlatformsModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  onSuccess,
}: ToggleConsolePlatformsModalProps) {
  const {enabledConsolePlatforms = [], consoleSdkInviteQuota = 0} = organization;

  const [pendingRevocations, setPendingRevocations] = useState<
    Array<{memberId: string; platform: ConsolePlatform}>
  >([]);

  const {
    data: userInvites = [],
    isPending: isInvitesFetchPending,
    isError: isInvitesFetchError,
    refetch: refetchInvites,
  } = useConsoleSdkInvites(organization.slug);

  // Filter out pending revocations from displayed invites
  const displayedInvites = userInvites
    .map(invite => {
      const filteredPlatforms = invite.platforms.filter(
        p =>
          !pendingRevocations.some(
            r => r.memberId === invite.memberId && r.platform === p
          )
      );
      return {...invite, platforms: filteredPlatforms};
    })
    .filter(invite => invite.platforms.length > 0);

  const {isPending: isRevokePending, mutateAsync: revokeConsoleInvites} =
    useRevokeConsoleSdkPlatformInvite();

  const queryClient = useQueryClient();

  const {isPending: isUpdatePending, mutateAsync: updateConsolePlatforms} = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const {newConsoleSdkInviteQuota, ...platforms} = data;
      return fetchMutation({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {
          enabledConsolePlatforms: (
            Object.keys(platforms) as Array<keyof typeof platforms>
          ).reduce<string[]>((acc, key) => {
            if (platforms[key]) {
              acc.push(key);
            }
            return acc;
          }, []),
          consoleSdkInviteQuota: Number(newConsoleSdkInviteQuota),
        },
      });
    },
  });

  const handleRevoke = ({
    memberId,
    platform,
  }: {
    memberId: string;
    platform: ConsolePlatform;
  }) => {
    setPendingRevocations(prev => [...prev, {memberId, platform}]);
  };

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    addLoadingMessage('Saving changes...');

    const promises: Array<Promise<unknown>> = [];

    if (pendingRevocations.length > 0) {
      promises.push(
        revokeConsoleInvites({
          orgSlug: organization.slug,
          items: pendingRevocations,
        })
      );
    }
    promises.push(updateConsolePlatforms(data));

    await Promise.all(promises)
      .then(() => {
        addSuccessMessage('Console SDK settings updated successfully');
        closeModal();
        onSuccess();
      })
      .catch(() => {
        addErrorMessage('Failed to update console SDK settings');
        setPendingRevocations([]);
      })
      .finally(() => {
        queryClient.invalidateQueries({
          queryKey: [`/organizations/${organization.slug}/console-sdk-invites/`],
        });
      });
  };

  const defaultValues: z.input<typeof formSchema> = {
    playstation: enabledConsolePlatforms.includes('playstation'),
    'nintendo-switch': enabledConsolePlatforms.includes('nintendo-switch'),
    xbox: enabledConsolePlatforms.includes('xbox'),
    newConsoleSdkInviteQuota: consoleSdkInviteQuota,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: formSchema},
    onSubmit: ({value}) => handleSubmit(value),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Toggle Console Platforms</Heading>
      </Header>
      <Body>
        <Text>
          Toggle consoles to allow users in this organization to create console projects
          and view private setup instructions.
        </Text>
        <form.AppField name="playstation">
          {field => (
            <field.Layout.Row
              label="PlayStation"
              hintText="Toggle the PlayStation console platform for this organization."
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="nintendo-switch">
          {field => (
            <field.Layout.Row
              label="Nintendo Switch"
              hintText="Toggle Nintendo Switch console platform for this organization."
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="xbox">
          {field => (
            <field.Layout.Row
              label="Xbox"
              hintText="Toggle the Xbox console platform for this organization."
            >
              <field.Switch checked={field.state.value} onChange={field.handleChange} />
            </field.Layout.Row>
          )}
        </form.AppField>
        <form.AppField name="newConsoleSdkInviteQuota">
          {field => (
            <field.Layout.Row
              label="GitHub Repo Invite Quota"
              hintText={`Set the maximum number of GitHub users that can be invited to our console SDK repositories. Currently ${userInvites.length} of ${consoleSdkInviteQuota} invites used.`}
            >
              <field.Number
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
              />
            </field.Layout.Row>
          )}
        </form.AppField>

        <SimpleTable
          columns={INVITE_COLUMNS}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>User</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>Platforms</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          <InvitesTableContent
            invites={displayedInvites}
            isPending={isInvitesFetchPending}
            isError={isInvitesFetchError}
            onRefetch={refetchInvites}
            onRevoke={handleRevoke}
          />
        </SimpleTable>

        <form.Subscribe selector={state => state.values}>
          {values => (
            <QuotaAlert
              playstation={values.playstation}
              nintendoSwitch={values['nintendo-switch']}
              xbox={values.xbox}
              quota={values.newConsoleSdkInviteQuota}
            />
          )}
        </form.Subscribe>
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton disabled={isUpdatePending || isRevokePending}>
          Save
        </form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

const StyledQuotaAlert = styled(Alert)`
  margin-top: ${p => p.theme.space.xl};
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
