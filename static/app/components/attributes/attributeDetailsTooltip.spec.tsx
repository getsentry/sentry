import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AttributeDetailsTooltip} from 'sentry/components/attributes/attributeDetailsTooltip';
import {FieldValueType} from 'sentry/utils/fields';

describe('AttributeDetailsTooltip', () => {
  it('describes the attribute when hovering its name', async () => {
    render(
      <AttributeDetailsTooltip attributeKey="logger.name" fieldDefinitionType="log" />
    );

    await userEvent.hover(screen.getByText('logger.name'));

    expect(await screen.findByText('string')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(
      screen.getByText('The name of the logger that generated this event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('renders the name underlined so it reads as something to hover', () => {
    render(
      <AttributeDetailsTooltip attributeKey="logger.name" fieldDefinitionType="log" />
    );

    expect(screen.getByText('logger.name')).toHaveStyle({
      textDecorationStyle: 'dotted',
    });
  });

  it('renders only the children inline when they are given', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="tags[code.line.number,number]"
        fieldDefinitionType="log"
        name="code.line.number"
      >
        number
      </AttributeDetailsTooltip>
    );

    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.queryByText('code.line.number')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('number'));

    expect(await screen.findByText('code.line.number')).toBeInTheDocument();
    expect(screen.getByText('integer')).toBeInTheDocument();
  });

  it('finds the definition when the key is prefixed but the name is not', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="sentry.logger.name"
        fieldDefinitionType="log"
        name="logger.name"
      />
    );

    await userEvent.hover(screen.getByText('logger.name'));

    expect(
      await screen.findByText('The name of the logger that generated this event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
  });

  it('describes an unknown attribute as a tag and credits nobody', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="my.custom.attribute"
        defaultValueType={FieldValueType.BOOLEAN}
        fieldDefinitionType="log"
      />
    );

    await userEvent.hover(screen.getByText('my.custom.attribute'));

    expect(await screen.findByText('boolean')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('A tag sent with one or more events')).toBeInTheDocument();
    expect(screen.queryByText('Added by Sentry')).not.toBeInTheDocument();
  });

  it('notes the value was scrubbed when the attribute is scrubbed', async () => {
    render(
      <AttributeDetailsTooltip
        attributeKey="user.email"
        fieldDefinitionType="log"
        isScrubbed
      />
    );

    await userEvent.hover(screen.getByText('user.email'));

    expect(await screen.findByText('Data scrubbed for privacy')).toBeInTheDocument();
  });

  it('omits the scrubbing note when the attribute is not scrubbed', async () => {
    render(
      <AttributeDetailsTooltip attributeKey="user.email" fieldDefinitionType="log" />
    );

    await userEvent.hover(screen.getByText('user.email'));

    expect(await screen.findByText('Description')).toBeInTheDocument();
    expect(screen.queryByText('Data scrubbed for privacy')).not.toBeInTheDocument();
  });
});
