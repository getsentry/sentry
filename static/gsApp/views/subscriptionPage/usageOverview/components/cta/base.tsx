import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {PanelCtaContent} from 'getsentry/views/subscriptionPage/usageOverview/components/cta/types';

interface CtaProps extends PanelCtaContent {
  background: 'primary' | 'secondary';
  hasContentBelow: boolean;
  subtitle: string;
  title: string;
  action?: React.ReactNode;
  findOutMoreHref?: string;
  icon?: React.ReactNode;
}

function FindOutMoreButton({
  href,
  to,
}:
  | {
      href: string;
      to?: never;
    }
  | {
      to: string;
      href?: never;
    }) {
  return (
    <LinkButton icon={<IconOpen />} priority="link" size="sm" href={href} to={to ?? ''}>
      {t('Find out more')}
    </LinkButton>
  );
}

function Cta({
  icon,
  title,
  subtitle,
  action,
  hasContentBelow,
  findOutMoreHref,
  footerText,
  image,
  background,
}: CtaProps) {
  return (
    <Flex
      background={background}
      padding="xl"
      direction="column"
      gap="xl"
      borderBottom={hasContentBelow ? 'primary' : undefined}
      radius={hasContentBelow ? undefined : '0 0 md md'}
      align="center"
      justify="center"
      height={hasContentBelow ? undefined : '100%'}
    >
      <Flex direction="column" gap="lg" align="center">
        {icon && (
          <Flex align="center" gap="sm">
            {icon}
          </Flex>
        )}
        {image && (
          <Flex align="center" gap="sm">
            {image}
          </Flex>
        )}
        <Text bold align="center" size="lg" textWrap="balance">
          {title}
        </Text>
        <Container maxWidth="300px">
          <Text variant="muted" size="sm" align="center" textWrap="balance">
            {subtitle}
          </Text>
        </Container>
      </Flex>
      <Flex direction="column" gap="lg" align="center">
        {action}
        {findOutMoreHref && <FindOutMoreButton href={findOutMoreHref} />}
      </Flex>
      {footerText && (
        <Text align="center" variant="muted" size="sm">
          {footerText}
        </Text>
      )}
    </Flex>
  );
}

/**
 * CTA with Seer context
 */
function SeerCta({action, footerText}: {action: React.ReactNode; footerText?: string}) {
  // TODO(isabella): If we ever extend this pattern to other products, we should
  // add copy to BILLED_DATA_CATEGORY_INFO or serialize them in some endpoint
  return (
    <Container background="secondary" height="100%" radius="md" alignSelf="stretch">
      <Flex
        direction="column"
        gap="xl"
        align="center"
        justify="center"
        maxWidth="80%"
        justifySelf="center"
        height="100%"
      >
        <Flex direction="column" gap="md">
          <Text align="center" size="xl" bold>
            {t('Find and fix issues anywhere with Seer AI debugger')}
          </Text>
          <Text as="div" align="center" size="sm">
            {/* TODO(seer): serialize pricing info */}
            <Text>$40 </Text>
            <Text variant="muted">{t('per active contributor / month')}</Text>
          </Text>
        </Flex>
        {action}
        {footerText && (
          <Text align="center" variant="muted" size="sm">
            {footerText}
          </Text>
        )}
      </Flex>
    </Container>
  );
}

export {Cta, SeerCta};
