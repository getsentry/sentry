import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {AttributesTree, type AttributesFieldRendererProps} from './attributesTree';

describe('attributesTree', () => {
  const organization = OrganizationFixture();

  const location = LocationFixture();

  const theme = ThemeFixture();

  it.each([
    ['span.op', 'sentry.op', 'span.op'],
    ['sentry.logger.name', 'sentry.logger.name', 'logger.name'],
    ['log.custom.name', 'log.custom.name', 'custom.name'],
    ['tags[sentry.custom,number]', 'sentry.custom', 'custom'],
  ])('gates display normalization for %s', (name, rawName, legacyName) => {
    const attributes: TraceItemResponseAttribute[] = [
      {name, rawName, type: 'str', value: 'test value'},
    ];
    const rendererExtra = {theme, location, navigate: jest.fn(), organization};
    const {rerender} = render(
      <AttributesTree attributes={attributes} rendererExtra={rendererExtra} />
    );

    expect(screen.getByTitle(legacyName)).toBeInTheDocument();
    expect(screen.getByText('test value')).toBeInTheDocument();

    rerender(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          ...rendererExtra,
          organization: OrganizationFixture({
            features: ['trace-item-details-raw-attribute-names'],
          }),
        }}
      />
    );

    expect(screen.getByTitle(rawName)).toBeInTheDocument();
    expect(screen.queryByTitle(legacyName)).not.toBeInTheDocument();
    expect(screen.getByText('test value')).toBeInTheDocument();
  });

  it('falls back to legacy display when rawName is unavailable', () => {
    render(
      <AttributesTree
        attributes={[{name: 'sentry.custom', type: 'str', value: 'test value'}]}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization: OrganizationFixture({
            features: ['trace-item-details-raw-attribute-names'],
          }),
        }}
      />
    );

    expect(screen.getByTitle('custom')).toBeInTheDocument();
    expect(screen.getByText('test value')).toBeInTheDocument();
  });

  it.each([false, true])(
    'preserves caller order with mixed raw names (raw names enabled: %s)',
    useRawAttributeNames => {
      render(
        <AttributesTree
          columnCount={1}
          attributes={[
            {
              name: 'span.op',
              rawName: 'sentry.op',
              type: 'str',
              value: 'operation value',
            },
            {
              name: 'span.duration',
              rawName: 'sentry.duration_ms',
              type: 'int',
              value: 42,
            },
            {name: 'middle', type: 'str', value: 'fallback value'},
            {
              name: 'tags[aaa.custom,string]',
              rawName: 'aaa.custom',
              type: 'str',
              value: 'custom value',
            },
          ]}
          rendererExtra={{
            theme,
            location,
            navigate: jest.fn(),
            organization: OrganizationFixture({
              features: useRawAttributeNames
                ? ['trace-item-details-raw-attribute-names']
                : [],
            }),
          }}
        />
      );

      expect(
        screen
          .getAllByText(/^(operation value|42|fallback value|custom value)$/)
          .map(element => element.textContent)
      ).toEqual(['operation value', '42', 'fallback value', 'custom value']);
    }
  );

  it('preserves deliberate order without raw names when the flag is enabled', () => {
    render(
      <AttributesTree
        columnCount={1}
        attributes={[
          {name: 'operation', type: 'str', value: 'http.server'},
          {name: 'duration', type: 'str', value: '200ms'},
          {name: 'start_timestamp', type: 'str', value: 'start value'},
          {name: 'end_timestamp', type: 'str', value: 'end value'},
        ]}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization: OrganizationFixture({
            features: ['trace-item-details-raw-attribute-names'],
          }),
        }}
      />
    );

    expect(
      screen
        .getAllByText(/^(http.server|200ms|start value|end value)$/)
        .map(element => element.textContent)
    ).toEqual(['http.server', '200ms', 'start value', 'end value']);
  });

  it('correctly renders attributes tree', () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'test value 1',
        name: 'test.attribute1',
      },
      {
        type: 'float',
        value: 42,
        name: 'test.attribute2',
      },
      {
        type: 'bool',
        value: true,
        name: 'test.attribute3',
      },
    ];

    const renderers = {
      'test.attribute2': (props: AttributesFieldRendererProps<RenderFunctionBaggage>) => {
        return <div>custom.renderered.value: {props.item.value}</div>;
      },
    };

    const getAdjustedAttributeKey = (attribute: TraceItemResponseAttribute) => {
      if (attribute.name === 'test.attribute1') {
        return 'test.attribute1-adjusted';
      }
      return attribute.name;
    };

    render(
      <AttributesTree
        attributes={attributes}
        getAdjustedAttributeKey={getAdjustedAttributeKey}
        renderers={renderers}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    // check rendered values
    expect(screen.getByText('test value 1')).toBeInTheDocument();
    expect(screen.getByText('custom.renderered.value: 42')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();

    // check rendered keys
    expect(screen.getByTestId('tree-key-test.attribute1-adjusted')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute1-adjusted')).toHaveTextContent(
      'attribute1'
    );
    expect(screen.getByTestId('tree-key-test.attribute2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute2')).toHaveTextContent(
      'attribute2'
    );
    expect(screen.getByTestId('tree-key-test.attribute3')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-test.attribute3')).toHaveTextContent(
      'attribute3'
    );
  });

  it('correctly renders cell actions', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'test value 1',
        name: 'test.attribute1',
      },
      {
        type: 'str',
        value: 'test value 2',
        name: 'test',
      },
      {
        type: 'str',
        value: 'test value 3',
        name: 'test.some-inner-thing.value',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
        getCustomActions={content => {
          if (!content.original) {
            return [];
          }

          const items: MenuItemProps[] = [
            {
              key: 'visible action',
              label: 'Visible Action',
              onAction: () => null,
            },
            {
              key: 'hidden-action',
              label: 'Hidden Action',
              hidden: true,
              onAction: () => null,
            },
            {
              key: 'disabled-action',
              label: 'Disabled Action',
              disabled: true,
              onAction: () => null,
            },
          ];

          return items;
        }}
      />
    );

    const allTreeRows = await screen.findAllByTestId('attribute-tree-row');
    expect(allTreeRows.length).toBeGreaterThan(0);
    for (const row of allTreeRows) {
      // test, test.row, test.deeply.nested.attribute
      await userEvent.hover(row);
      const actionsButton = within(row).queryByRole('button', {
        name: 'Attribute Actions Menu',
      });
      if (actionsButton === null) {
        expect(row?.textContent).toBe('some-inner-thing');
        continue;
      }
      // jsdom does not evaluate :hover styles, so bypass the hidden action's pointer-events check.
      await userEvent.click(actionsButton, {pointerEventsCheck: 0});
      expect(await within(row).findByText('Visible Action')).toBeInTheDocument();
      expect(await within(row).findByText('Disabled Action')).toBeInTheDocument();
      expect(within(row).queryByText('Hidden Action')).not.toBeInTheDocument();
    }
  });

  it('renders an array attribute and types it as array in its details', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'array',
        value: ['timestamp', 'message'],
        name: 'tags[csv_headers,array]',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        config={{attributeDetailsType: 'log'}}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    expect(screen.getByTestId('attribute-tree-row')).toHaveTextContent(
      '[timestamp,message]'
    );

    await userEvent.hover(
      within(screen.getByTestId('tree-key-tags[csv_headers,array]')).getByText(
        'csv_headers'
      )
    );

    expect(await screen.findByText('array')).toBeInTheDocument();
  });

  it('describes an attribute key when an attribute details type is given', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'sentry.python',
        name: 'sentry.logger.name',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        config={{attributeDetailsType: 'log'}}
        getAdjustedAttributeKey={() => 'logger.name'}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    await userEvent.hover(
      within(screen.getByTestId('tree-key-logger.name')).getByText('name')
    );

    expect(
      await screen.findByText('The name of the logger that generated this event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('notes an attribute was scrubbed when its trace item meta carries a remark', async () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: '[Filtered]',
        name: 'user.email',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        config={{attributeDetailsType: 'log'}}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
          traceItemMeta: {
            'user.email': {
              meta: {value: {'': {len: 10, rem: [['@email', 's', 0, 10]]}}},
            },
          },
        }}
      />
    );

    await userEvent.hover(
      within(screen.getByTestId('tree-key-user.email')).getByText('email')
    );

    expect(await screen.findByText('Data scrubbed for privacy')).toBeInTheDocument();
  });

  it('falls back to a plain browser tooltip when no attribute details type is given', () => {
    const attributes: TraceItemResponseAttribute[] = [
      {
        type: 'str',
        value: 'sentry.python',
        name: 'sentry.logger.name',
      },
    ];

    render(
      <AttributesTree
        attributes={attributes}
        rendererExtra={{
          theme,
          location,
          navigate: jest.fn(),
          organization,
        }}
      />
    );

    expect(screen.getByTitle('logger.name')).toContainElement(
      screen.getByTestId('tree-key-sentry.logger.name')
    );
  });
});
