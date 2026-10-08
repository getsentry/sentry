import {useState} from 'react';
import {useTheme} from '@emotion/react';
import {useMutation} from '@tanstack/react-query';
import {AnimatePresence, motion} from 'framer-motion';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {useScrapsForm, ScrapsForm, defaultFormValidators} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {IconArrow, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

const joinRequestSchema = z.object({
  email: z.email(t('Enter a valid email')),
});

export function OrganizationJoinRequest({organizationSlug}: {organizationSlug: string}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const theme = useTheme();
  const actionLabel = isOpen
    ? isSent
      ? t('Sounds good')
      : t('Nevermind')
    : t('Request to join');

  function handleAction() {
    if (isSent) {
      setIsSent(false);
    }

    setIsOpen(open => !open);
  }

  return (
    <Stack gap="0" borderTop="secondary" width="100%">
      <Flex align="center" justify="between" gap="lg" padding="sm lg">
        <Text size="sm">{t('Not a member?')}</Text>
        <Button
          icon={isOpen ? undefined : <IconMegaphone />}
          size="xs"
          variant="transparent"
          onClick={handleAction}
        >
          {actionLabel}
        </Button>
      </Flex>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{height: 0, overflow: 'hidden'}}
            animate={{
              height: 'auto',
              overflow: 'hidden',
              transitionEnd: {overflow: 'visible'},
            }}
            exit={{height: 0, overflow: 'hidden'}}
            transition={theme.motion.framer.smooth.moderate}
          >
            <Container paddingBottom="lg" paddingLeft="lg" paddingRight="lg">
              {isSent ? (
                <Text role="status" size="sm" variant="success">
                  {t("Sent. You'll receive an email when your request is approved.")}
                </Text>
              ) : (
                <JoinRequestForm
                  organizationSlug={organizationSlug}
                  onSuccess={() => setIsSent(true)}
                />
              )}
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </Stack>
  );
}

function JoinRequestForm({
  organizationSlug,
  onSuccess,
}: {
  onSuccess: () => void;
  organizationSlug: string;
}) {
  const location = useLocation();
  const mutation = useMutation({
    mutationFn: (data: {email: string}) =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/join-request/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      trackAnalytics('join_request.created', {
        organization: organizationSlug,
        referrer: decodeScalar(location.query.referrer, ''),
      });
      onSuccess();
    },
    onError: () => {
      addErrorMessage(t('Could not send request. Try again.'));
    },
  });

  const form = useScrapsForm({
    defaultValues: {email: ''},
    validators: defaultFormValidators(joinRequestSchema),
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  return (
    <ScrapsForm form={form}>
      <form.Field name="email">
        {field => (
          <Stack gap="sm">
            <field.Input
              type="email"
              value={field.value}
              onChange={field.handleChange}
              aria-label={t('Email')}
              autoComplete="email"
              placeholder={t('Email')}
              trailingItems={
                <form.SubmitButton
                  aria-label={t('Send request')}
                  icon={<IconArrow direction="right" />}
                  size="xs"
                  tooltipProps={{title: t('Send request')}}
                  variant="transparent"
                />
              }
            />
            <Text size="xs" variant="muted">
              {t("Enter your email and we'll let the organization owners know.")}
            </Text>
          </Stack>
        )}
      </form.Field>
    </ScrapsForm>
  );
}
