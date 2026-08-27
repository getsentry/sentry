import {useCallback, useEffect, useRef, useState, type ComponentType} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen} from 'sentry/icons/iconOpen';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';

const MIN_HEIGHT = 112;

export function LazyEvidence({children}: {children: React.ReactNode}) {
  const [isVisible, setIsVisible] = useState(
    () => typeof IntersectionObserver === 'undefined' || process.env.NODE_ENV === 'test'
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (isVisible || !container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {rootMargin: '200px'}
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        children
      ) : (
        <EvidencePlaceholder testId="evidence-viewport-placeholder" />
      )}
    </div>
  );
}

export function EvidenceBoundary({children}: {children: React.ReactNode}) {
  const renderFallback = useCallback(
    () => (
      <EvidenceFrame title={t('Evidence unavailable')}>
        <Text variant="muted">{t('This evidence could not be rendered.')}</Text>
      </EvidenceFrame>
    ),
    []
  );

  return <ErrorBoundary customComponent={renderFallback}>{children}</ErrorBoundary>;
}

export function EvidenceFrame({
  children,
  detail,
  error,
  href,
  icon: Icon,
  isLoading = false,
  onRetry,
  title,
}: {
  title: string;
  children?: React.ReactNode;
  detail?: React.ReactNode;
  error?: unknown;
  href?: string;
  icon?: ComponentType<SVGIconProps>;
  isLoading?: boolean;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <Frame data-test-id="evidence-embed-loading">
        <Stack gap="md">
          <Placeholder height="18px" width="35%" />
          <Placeholder height="36px" />
        </Stack>
      </Frame>
    );
  }

  const status = error instanceof RequestError ? error.status : undefined;
  if (error) {
    const isForbidden = status === 401 || status === 403;
    const isUnavailable = status === 404;
    const canRetry = !isForbidden && !isUnavailable;
    const message = isForbidden
      ? t("You don't have access to this evidence.")
      : isUnavailable
        ? t('This evidence is no longer available or has expired.')
        : t('This evidence could not be loaded.');

    return (
      <Frame data-test-id="evidence-embed-error">
        <Flex align="center" justify="between" gap="lg">
          <Stack gap="xs">
            <Text bold>{t('Evidence unavailable')}</Text>
            <Text variant="muted">{message}</Text>
          </Stack>
          <Flex gap="sm">
            {canRetry && onRetry ? (
              <Button size="xs" onClick={onRetry}>
                {t('Retry')}
              </Button>
            ) : null}
            {!isForbidden && href ? (
              <LinkButton size="xs" icon={<IconOpen />} to={href}>
                {t('Open in Sentry')}
              </LinkButton>
            ) : null}
          </Flex>
        </Flex>
      </Frame>
    );
  }

  return (
    <Frame data-test-id="evidence-embed">
      <Stack gap="md">
        <Flex align="center" justify="between" gap="lg">
          <Flex align="center" gap="sm" minWidth="0">
            {Icon ? <Icon size="sm" /> : null}
            <Stack gap="2xs" minWidth="0">
              <Text bold>{title}</Text>
              {detail ? <Text variant="muted">{detail}</Text> : null}
            </Stack>
          </Flex>
          {href ? (
            <LinkButton size="xs" icon={<IconOpen />} to={href}>
              {t('Open in Sentry')}
            </LinkButton>
          ) : null}
        </Flex>
        {children}
      </Stack>
    </Frame>
  );
}

const Frame = styled('section')`
  min-height: ${MIN_HEIGHT}px;
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
`;

const EvidencePlaceholder = styled(Placeholder)`
  min-height: ${MIN_HEIGHT}px;
`;
