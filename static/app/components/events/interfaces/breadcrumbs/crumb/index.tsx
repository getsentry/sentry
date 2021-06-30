import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {BreadcrumbsWithDetails, BreadcrumbType} from 'app/types/breadcrumbs';
import {Event} from 'app/types/event';

import layout from '../layout';

import Category from './category';
import Data from './data';
import Level from './level';
import Time from './time';
import Type from './type';

type Props = {
  crumb: BreadcrumbsWithDetails[0];
  event: Event;
  orgSlug: string | null;
  searchTerm: string;
  isLastItem: boolean;
  displayRelativeTime: boolean;
  relativeTime?: string;
  onLoad?: () => void;
  height?: string;
  style?: React.CSSProperties;
};

function Breadcrumb({
  crumb,
  searchTerm,
  relativeTime,
  displayRelativeTime,
  event,
  orgSlug,
  style,
  ...props
}: Props) {
  const {icon, color, category, type, level, description, timestamp} = crumb;
  const hasError = type === BreadcrumbType.ERROR;
  return (
    <Wrapper {...props} style={style} hasError={hasError}>
      <Column>
        <TypeWrapper>
          <Tooltip title={description}>
            <Type icon={icon} color={color} />
          </Tooltip>
        </TypeWrapper>
      </Column>
      <Column>
        <Category category={category} searchTerm={searchTerm} />
      </Column>
      <Column>
        <Data
          event={event}
          orgSlug={orgSlug}
          breadcrumb={crumb}
          searchTerm={searchTerm}
        />
      </Column>
      <Column>
        <Level level={level} searchTerm={searchTerm} />
      </Column>
      <Column>
        <Time
          timestamp={timestamp}
          relativeTime={relativeTime}
          displayRelativeTime={displayRelativeTime}
          searchTerm={searchTerm}
        />
      </Column>
    </Wrapper>
  );
}

export default Breadcrumb;

const Column = styled('div')`
  padding: ${space(2)};
  display: flex;
  align-items: center;
  position: relative;
  word-break: break-all;
`;

const TypeWrapper = styled('div')`
  justify-content: center;
  display: flex;
  :before {
    content: '';
    display: block;
    width: 1px;
    top: 0;
    bottom: 0;
    background: ${p => p.theme.innerBorder};
    position: absolute;
  }
`;

const Wrapper = styled('div')<{hasError: boolean}>`
  :not(:last-child) {
    > * {
      border-bottom: 1px solid ${p => p.theme.border};
    }
  }
  ${p => layout(p.theme)};

  ${p =>
    p.hasError &&
    `
      > * {
        border-top: 1px solid ${p.theme.red300};
        margin-top: -1px;
      }
      ${TypeWrapper} {
        :before {
          background: ${p.theme.red300};
        }
      }
    `}
`;
