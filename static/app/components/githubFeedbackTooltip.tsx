import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip, TooltipProps} from 'sentry/components/tooltip';
import {IconGithub} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type GithubFeedbackTooltipProps = TooltipProps & {
  href: string;
  title?: React.ReactNode;
};

export function GithubFeedbackTooltip({
  href,
  title,
  ...props
}: GithubFeedbackTooltipProps) {
  return (
    <Tooltip
      isHoverable
      title={
        <Fragment>
          {title}
          <FeedbackLine hasTitle={!!title}>
            {tct('Give us feedback on [githubLink]', {
              githubLink: (
                <GithubLink href={href}>
                  GitHub <IconGithub size="xs" />
                </GithubLink>
              ),
            })}
          </FeedbackLine>
        </Fragment>
      }
      {...props}
    />
  );
}

const FeedbackLine = styled('div')<{hasTitle: boolean}>`
  ${p => p.hasTitle && `padding-top: ${space(1)};`}
`;

const GithubLink = styled(ExternalLink)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${space(0.5)};
  line-height: 0px;

  & > svg {
    margin-top: -1px;
  }
`;
