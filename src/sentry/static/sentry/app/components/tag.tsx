import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import theme, {Theme, Color} from 'app/utils/theme';
import space from 'app/styles/space';
import {IconClose, IconOpen} from 'app/icons';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';

const TAG_HEIGHT = '17px';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  /**
   * Dictates color scheme of the tag.
   */
  type?: keyof Theme['tag'];
  /**
   * Icon on the left side.
   */
  icon?: React.ReactElement;
  /**
   * Text to show up on a hover.
   */
  tooltipText?: React.ReactElement | string;
  /**
   * Makes the tag clickable. Use for internal links handled by react router.
   * If no icon is passed, it defaults to IconOpen (can be removed by passing icon={null})
   */
  to?: React.ComponentProps<typeof Link>['to'];
  /**
   * Makes the tag clickable. Use for external links.
   * If no icon is passed, it defaults to IconOpen (can be removed by passing icon={null})
   */
  href?: string;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
};

function Tag({
  type = 'default',
  icon,
  tooltipText,
  to,
  href,
  onDismiss,
  children,
  ...props
}: Props) {
  const iconsProps = {
    size: '10px',
    color: theme.tag[type].iconColor as Color,
  };

  const tag = (
    <Tooltip title={tooltipText} containerDisplayMode="inline">
      <Background type={type}>
        {tagIcon()}

        <Text>{children}</Text>

        {defined(onDismiss) && (
          <DismissButton
            onClick={handleDismiss}
            size="zero"
            priority="link"
            label={t('Dismiss')}
          >
            <IconClose {...iconsProps} />
          </DismissButton>
        )}
      </Background>
    </Tooltip>
  );

  function handleDismiss(event: React.MouseEvent) {
    event.preventDefault();
    onDismiss?.();
  }

  function tagIcon() {
    if (React.isValidElement(icon)) {
      return <IconWrapper>{React.cloneElement(icon, {...iconsProps})}</IconWrapper>;
    }

    if ((defined(href) || defined(to)) && icon === undefined) {
      return (
        <IconWrapper>
          <IconOpen {...iconsProps} />
        </IconWrapper>
      );
    }

    return null;
  }

  function tagWithParent() {
    if (defined(href)) {
      return <ExternalLink href={href}>{tag}</ExternalLink>;
    }

    if (defined(to)) {
      return <Link to={to}>{tag}</Link>;
    }

    return tag;
  }

  return <span {...props}>{tagWithParent()}</span>;
}

const Background = styled('div')<{type: keyof Theme['tag']}>`
  display: inline-flex;
  align-items: center;
  height: ${TAG_HEIGHT};
  border-radius: ${TAG_HEIGHT};
  background-color: ${p => p.theme.tag[p.type].background};
  padding: 0 ${space(0.75)};
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
`;

const Text = styled('span')`
  color: ${p => p.theme.gray700};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  max-width: 150px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: ${TAG_HEIGHT};
  a:hover & {
    color: ${p => p.theme.gray800};
  }
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
`;

export default Tag;
