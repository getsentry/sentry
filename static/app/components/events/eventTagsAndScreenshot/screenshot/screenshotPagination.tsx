// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CursorHandler} from 'sentry/components/pagination';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';

type Props = WithRouterProps & {
  nextDisabled: boolean;
  onCursor: CursorHandler;
  previousDisabled: boolean;
  pageLinks?: string | null;
};

/*
  HACK: Slight variation of the Pagination
  component that allows the parent to control
  enabling/disabling the pagination buttons.
*/
const ScreenshotPagination = ({
  location,
  onCursor,
  pageLinks,
  previousDisabled,
  nextDisabled,
}: Props) => {
  if (!pageLinks) {
    return null;
  }

  const path = location.pathname;
  const query = location.query;
  const links = parseLinkHeader(pageLinks);

  return (
    <Wrapper>
      <ButtonBar merged>
        <Button
          icon={<IconChevron direction="left" size="sm" />}
          aria-label={t('Previous')}
          size="md"
          disabled={previousDisabled}
          onClick={() => {
            onCursor?.(links.previous?.cursor, path, query, -1);
          }}
        />
        <Button
          icon={<IconChevron direction="right" size="sm" />}
          aria-label={t('Next')}
          size="md"
          disabled={nextDisabled}
          onClick={() => {
            onCursor?.(links.next?.cursor, path, query, 1);
          }}
        />
      </ButtonBar>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: 0;
`;

export default withRouter(ScreenshotPagination);
