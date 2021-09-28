import {memo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {Organization} from 'app/types';
import {BreadcrumbType, Crumb} from 'app/types/breadcrumbs';
import {Event} from 'app/types/event';

import Category from './category';
import Data from './data';
import Level from './level';
import Time from './time';
import Type from './type';

type Props = {
  breadcrumb: Crumb;
  event: Event;
  orgSlug: Organization['slug'];
  searchTerm: string;
  relativeTime: string;
  displayRelativeTime: boolean;
  style: React.CSSProperties;
  onLoad: () => void;
  ['data-test-id']: string;
  scrollbarSize: number;
  height?: string;
};

const Breadcrumb = memo(function Breadcrumb({
  orgSlug,
  event,
  breadcrumb,
  relativeTime,
  displayRelativeTime,
  searchTerm,
  onLoad,
  scrollbarSize,
  style,
  ['data-test-id']: dataTestId,
}: Props) {
  const {type, description, color, level, category, timestamp} = breadcrumb;
  const error = breadcrumb.type === BreadcrumbType.ERROR;

  return (
    <Wrapper
      style={style}
      error={error}
      onLoad={onLoad}
      data-test-id={dataTestId}
      scrollbarSize={scrollbarSize}
    >
      <Type type={type} color={color} description={description} error={error} />
      <Category category={category} searchTerm={searchTerm} />
      <Data
        event={event}
        orgSlug={orgSlug}
        breadcrumb={breadcrumb}
        searchTerm={searchTerm}
      />
      <div>
        <Level level={level} searchTerm={searchTerm} />
      </div>
      <Time
        timestamp={timestamp}
        relativeTime={relativeTime}
        displayRelativeTime={displayRelativeTime}
        searchTerm={searchTerm}
      />
    </Wrapper>
  );
});

export default Breadcrumb;

const Wrapper = styled('div')<{error: boolean; scrollbarSize: number}>`
  display: grid;
  grid-template-columns: 64px 140px 1fr 106px 100px ${p => p.scrollbarSize}px;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  @media (max-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-rows: repeat(2, auto);
    grid-template-columns: max-content 1fr 74px 82px ${p => p.scrollbarSize}px;

    > * {
      padding: ${space(1)};

      /* Type */
      :nth-child(5n-4) {
        grid-row: 1/-1;
        padding-right: 0;
        padding-left: 0;
        margin-left: ${space(2)};
        margin-right: ${space(1)};
      }

      /* Data */
      :nth-child(5n-2) {
        grid-row: 2/2;
        grid-column: 2/-1;
        padding-right: ${space(2)};
      }

      /* Level */
      :nth-child(5n-1) {
        padding-right: 0;
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
      }

      /* Time */
      :nth-child(5n) {
        padding: ${space(1)} ${space(2)};
      }
    }
  }

  word-break: break-all;
  white-space: pre-wrap;
  :not(:last-child) {
    border-bottom: 1px solid ${p => (p.error ? p.theme.red300 : p.theme.innerBorder)};
  }

  ${p =>
    p.error &&
    css`
      :after {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        height: 1px;
        width: 100%;
        background: ${p.theme.red300};
      }
    `}
`;
