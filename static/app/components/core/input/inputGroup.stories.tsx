import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input/index';
import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix from 'sentry/components/stories/matrix';
import {IconAttachment, IconSearch, IconSettings} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

import {InputGroup} from './inputGroup';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/input/inputGroup';

export default storyBook('InputGroup', (story, APIReference) => {
  APIReference(types.InputGroup);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Input" /> component comes in different sizes:
        </p>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input placeholder="Search" />
        </InputGroup>
        <Input placeholder="hodl" />
      </Fragment>
    );
  });

  story('Non-interactive items', () => {
    return (
      <Fragment>
        <p>
          If we put items in the leading or trailing items that are not interactive, we
          should set <code>disablePointerEvents</code> so that mouse clicks will fall
          through to the <code>Input</code> underneath and trigger a focus event.
        </p>
        <Grid>
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input placeholder="Search" />
          </InputGroup>
          <InputGroup>
            <InputGroup.Input placeholder="Search" />
            <InputGroup.TrailingItems disablePointerEvents>
              <IconAttachment />
            </InputGroup.TrailingItems>
          </InputGroup>
        </Grid>
      </Fragment>
    );
  });

  story('Matrix', () => {
    return (
      <Fragment>
        <Matrix
          render={({leadingItems, trailingItems}) => {
            return (
              <InputGroup>
                {leadingItems ? (
                  <InputGroup.LeadingItems disablePointerEvents>
                    {leadingItems}
                  </InputGroup.LeadingItems>
                ) : null}
                <InputGroup.Input placeholder="Search" />
                {trailingItems ? (
                  <InputGroup.TrailingItems>{trailingItems}</InputGroup.TrailingItems>
                ) : null}
              </InputGroup>
            );
          }}
          selectedProps={['leadingItems', 'trailingItems']}
          propMatrix={{
            leadingItems: [null, <IconSearch key="leading-icon" size="sm" />],
            trailingItems: [
              null,
              <IconAttachment key="trailing-icon" size="sm" />,
              <Button
                key="trailing-button"
                borderless
                icon={<IconSettings />}
                size="sm"
                aria-label="Toggle story representation"
              />,
            ],
          }}
        />
      </Fragment>
    );
  });
});

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
`;
