import type {ComponentProps, ReactNode} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import AnalyticsArea, {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Button, LinkButton} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function Resource({
  title,
  subtitle,
  link,
}: {
  link: string;
  subtitle: ReactNode;
  title: string;
}) {
  const analyticsArea = useAnalyticsArea();
  return (
    <StyledLinkButton
      icon={<IconOpen />}
      borderless
      external
      href={link}
      analyticsEventKey="learn-more-resource.clicked"
      analyticsEventName="Clicked learn more resource"
      analyticsParams={{surface: analyticsArea, title}}
    >
      <ButtonContent>
        <ButtonTitle>{title}</ButtonTitle>
        <ButtonSubtitle>{subtitle}</ButtonSubtitle>
      </ButtonContent>
    </StyledLinkButton>
  );
}

function Buttons() {
  return (
    <ButtonContainer>
      <Resource
        title={t('Debugging Hydration Errors')}
        subtitle={t(
          'Learn about the tools Sentry offers to help debug why a Hydration Error is happening.'
        )}
        link="https://docs.sentry.io/product/issues/issue-details/replay-issues/hydration-error/#debugging-hydration-errors"
      />
      <Resource
        title={t('Fixing Hydration Errors')}
        subtitle={t(
          'Read more about why Hydration Errors occur, and how to prevent them.'
        )}
        link="https://sentry.io/answers/hydration-error-nextjs/"
      />
    </ButtonContainer>
  );
}

export default function LearnMoreButton(
  hoverCardProps: Partial<ComponentProps<typeof Hovercard>>
) {
  return (
    <ClassNames>
      {({css}) => (
        <AnalyticsArea name="learn-more">
          <Hovercard
            {...hoverCardProps}
            body={<Buttons />}
            bodyClassName={css`
              padding: ${space(1)};
            `}
            position="top-end"
          >
            <Button
              size="sm"
              icon={<IconQuestion />}
              aria-label={t('learn more about hydration errors')}
            >
              {t('Learn More')}
            </Button>
          </Hovercard>
        </AnalyticsArea>
      )}
    </ClassNames>
  );
}

const ButtonContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-start;
`;

const ButtonContent = styled('div')`
  display: flex;
  flex-direction: column;
  text-align: left;
  white-space: pre-line;
  gap: ${space(0.25)};
`;

const ButtonTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const ButtonSubtitle = styled('div')`
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLinkButton = styled(LinkButton)`
  padding: ${space(1)};
  height: auto;
`;
