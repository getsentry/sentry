import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import theme, {Theme, Color} from 'app/utils/theme';
import space from 'app/styles/space';
import {IconClose} from 'app/icons';
import Button from 'app/components/button';
import Tooltip from 'app/components/tooltip';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  type?: keyof Theme['tag'];
  icon?: React.ReactNode;
  tooltip?: string;
  to?: React.ComponentProps<typeof Link>['to'];
  href?: string;
  onDismiss?: () => void;
};

function Tag({
  type = 'default',
  icon,
  tooltip,
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
    <Tooltip title={tooltip} containerDisplayMode="inline">
      <Background type={type}>
        {React.isValidElement(icon) && (
          <IconWrapper>{React.cloneElement(icon, {...iconsProps})}</IconWrapper>
        )}

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

  function tagWithParent() {
    if (defined(href)) {
      return <ExternalLink href={href}>{tag}</ExternalLink>;
    }

    if (defined(to)) {
      return (
        <Link to={to} {...props}>
          {tag}
        </Link>
      );
    }

    return tag;
  }

  return <span {...props}>{tagWithParent()}</span>;
}

const Background = styled('div')<{type: keyof Theme['tag']}>`
  display: inline-flex;
  align-items: center;
  height: 17px;
  line-height: 1;
  border-radius: 17px;
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
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
`;

export default Tag;
