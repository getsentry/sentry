import {useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {
  CONSOLE_PLATFORM_METADATA,
  ConsolePlatform,
} from 'sentry/constants/consolePlatforms';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

const PLATFORMS = [
  ConsolePlatform.PLAYSTATION,
  ConsolePlatform.NINTENDO_SWITCH,
  ConsolePlatform.XBOX,
] as const;

const INVITE_QUOTA_ERROR = 'Invite quota must be 0 or greater';

const schema = z.object({
  [ConsolePlatform.PLAYSTATION]: z.boolean(),
  [ConsolePlatform.NINTENDO_SWITCH]: z.boolean(),
  [ConsolePlatform.XBOX]: z.boolean(),
  newConsoleSdkInviteQuota: z
    .number()
    .min(0, INVITE_QUOTA_ERROR)
    .nullable()
    .refine(value => value !== null, INVITE_QUOTA_ERROR),
});

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

  const updateMutation = useMutation({
    mutationFn: (data: {
      consoleSdkInviteQuota: number;
      enabledConsolePlatforms: string[];
    }) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data,
      }),
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

  const defaultValues: z.input<typeof schema> = {
    [ConsolePlatform.PLAYSTATION]: enabledConsolePlatforms.includes(
      ConsolePlatform.PLAYSTATION
    ),
    [ConsolePlatform.NINTENDO_SWITCH]: enabledConsolePlatforms.includes(
      ConsolePlatform.NINTENDO_SWITCH
    ),
    [ConsolePlatform.XBOX]: enabledConsolePlatforms.includes(ConsolePlatform.XBOX),
    newConsoleSdkInviteQuota: consoleSdkInviteQuota,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const {newConsoleSdkInviteQuota, ...platforms} = schema.parse(value);
      toast.loading('Saving changes...');

      const promises: Array<Promise<unknown>> = [];

      if (pendingRevocations.length > 0) {
        promises.push(
          revokeConsoleInvites({orgSlug: organization.slug, items: pendingRevocations})
        );
      }
      promises.push(
        updateMutation.mutateAsync({
          enabledConsolePlatforms: PLATFORMS.filter(platform => platforms[platform]),
          consoleSdkInviteQuota: newConsoleSdkInviteQuota,
        })
      );

      return Promise.all(promises)
        .then(() => {
          toast.success('Console SDK settings updated successfully');
          closeModal();
          onSuccess();
        })
        .catch(() => {
          toast.error('Failed to update console SDK settings');
          setPendingRevocations([]);
        })
        .finally(() => {
          queryClient.invalidateQueries(
            apiOptions.queryFilter(
              '/organizations/$organizationIdOrSlug/console-sdk-invites/',
              {path: {organizationIdOrSlug: organization.slug}}
            )
          );
        });
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Flex align="center" gap="xl">
          <h4>Toggle Console Platforms</h4>
        </Flex>
      </Header>
      <Body>
        <Stack gap="xl">
          <Text as="p">
            Toggle consoles to allow users in this organization to create console projects
            and view private setup instructions.
          </Text>
          <Stack gap="lg">
            <form.AppField name={ConsolePlatform.PLAYSTATION}>
              {field => (
                <field.Layout.Row
                  label="PlayStation"
                  hintText="Toggle the PlayStation console platform for this organization."
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name={ConsolePlatform.NINTENDO_SWITCH}>
              {field => (
                <field.Layout.Row
                  label="Nintendo Switch"
                  hintText="Toggle Nintendo Switch console platform for this organization."
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name={ConsolePlatform.XBOX}>
              {field => (
                <field.Layout.Row
                  label="Xbox"
                  hintText="Toggle the Xbox console platform for this organization."
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
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
          </Stack>

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

          <form.Subscribe
            selector={state =>
              PLATFORMS.some(platform => state.values[platform]) &&
              state.values.newConsoleSdkInviteQuota === 0
            }
          >
            {showQuotaWarning =>
              showQuotaWarning ? (
                <Alert variant="warning">
                  You have enabled console platforms but the invite quota is set to 0.
                  Users won't be able to request access to the console SDK repositories
                  anymore.
                </Alert>
              ) : null
            }
          </form.Subscribe>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>Cancel</Button>
          <form.SubmitButton disabled={isRevokePending}>Save</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

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
