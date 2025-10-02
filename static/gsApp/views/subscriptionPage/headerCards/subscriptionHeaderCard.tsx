import React, {cloneElement, Fragment, isValidElement} from 'react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import {Heading, Text} from 'sentry/components/core/text';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface ButtonInfo {
  ariaLabel: string;
  label: React.ReactNode;
  priority: 'primary' | 'default';
  icon?: React.ReactNode;
  linkTo?: string;
  onClick?: () => void;
}

interface SubscriptionHeaderCardProps {
  sections: React.ReactNode[];
  button?: ButtonInfo;
  icon?: React.ReactNode;
  isMainCard?: boolean;
  subtitle?: React.ReactNode;
  title?: React.ReactNode;
}

function SubscriptionHeaderCard({
  title,
  icon,
  sections,
  button,
  isMainCard = false,
  subtitle,
}: SubscriptionHeaderCardProps) {
  const hasCustomTitle = icon || title;
  const getButtonContent = () => {
    if (!button) {
      return null;
    }
    return (
      <Flex align="center" gap="sm">
        {isValidElement(button.icon)
          ? cloneElement(button.icon, {size: 'sm'} as SVGIconProps)
          : null}
        {button.label}
      </Flex>
    );
  };

  return (
    <Flex
      direction="column"
      padding="xl"
      background={isMainCard ? 'secondary' : 'primary'}
      border="primary"
      radius="md"
      gap="xs"
    >
      {hasCustomTitle && (
        <Flex align="center" gap="sm">
          {isValidElement(icon) &&
            cloneElement(icon, {size: 'sm', color: 'subText'} as SVGIconProps)}
          <Heading as="h2" size="lg">
            {title}
          </Heading>
        </Flex>
      )}
      {subtitle && <Text variant="muted">{subtitle}</Text>}
      <Flex direction="column" gap="md" padding="xl 0">
        {sections.map((section, index) => {
          const isLast = index === sections.length - 1;
          return (
            <Fragment key={index}>
              {section}
              {!isLast && <Separator orientation="horizontal" border="primary" />}
            </Fragment>
          );
        })}
      </Flex>
      {button &&
        (button.linkTo ? (
          <LinkButton
            priority={button.priority}
            aria-label={button.ariaLabel}
            to={button.linkTo}
          >
            {getButtonContent()}
          </LinkButton>
        ) : (
          <Button onClick={button.onClick} aria-label={button.ariaLabel}>
            {getButtonContent()}
          </Button>
        ))}
    </Flex>
  );
}

export default SubscriptionHeaderCard;
