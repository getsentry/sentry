import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventIdField from 'app/views/settings/components/dataScrubbing/modals/form/eventIdField';
import {EventIdStatus, EventId} from 'app/views/settings/components/dataScrubbing/types';
import theme from 'app/utils/theme';

const handleUpdateEventId = jest.fn();
const eventIdValue = '887ab369df634e74aea708bcafe1a175';

function renderComponent({
  value = eventIdValue,
  status,
}: Omit<EventId, 'value'> & Partial<Pick<EventId, 'value'>>) {
  return mountWithTheme(
    <EventIdField onUpdateEventId={handleUpdateEventId} eventId={{value, status}} />
  );
}

describe('EventIdField', () => {
  it('default render', () => {
    const wrapper = renderComponent({value: '', status: EventIdStatus.UNDEFINED});
    const eventIdField = wrapper.find('Field');
    expect(eventIdField.exists()).toBe(true);
    expect(eventIdField.find('FieldLabel').text()).toEqual('Event ID (Optional)');
    const eventIdFieldHelp =
      'Providing an event ID will automatically provide you a list of suggested sources';
    expect(eventIdField.find('QuestionTooltip').prop('title')).toEqual(eventIdFieldHelp);
    expect(eventIdField.find('Tooltip').prop('title')).toEqual(eventIdFieldHelp);
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual('');
    expect(eventIdFieldInput.prop('placeholder')).toEqual('XXXXXXXXXXXXXX');
    eventIdFieldInput.simulate('change', {
      target: {value: '887ab369df634e74aea708bcafe1a175'},
    });
    eventIdFieldInput.simulate('blur');
    expect(handleUpdateEventId).toHaveBeenCalled();
  });

  it('LOADING status', () => {
    const wrapper = renderComponent({status: EventIdStatus.LOADING});
    const eventIdField = wrapper.find('Field');
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual(eventIdValue);
    expect(eventIdField.find('FieldError')).toHaveLength(0);
    expect(eventIdField.find('CloseIcon')).toHaveLength(0);
    expect(eventIdField.find('FormSpinner')).toHaveLength(1);
  });

  it('LOADED status', () => {
    const wrapper = renderComponent({status: EventIdStatus.LOADED});
    const eventIdField = wrapper.find('Field');
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual(eventIdValue);
    expect(eventIdField.find('FieldError')).toHaveLength(0);
    expect(eventIdField.find('CloseIcon')).toHaveLength(0);
    const iconCheckmark = eventIdField.find('IconCheckmark');
    expect(iconCheckmark).toHaveLength(1);
    const iconCheckmarkColor = iconCheckmark.prop('color');
    expect(theme[iconCheckmarkColor]).toBe(theme.green400);
  });

  it('ERROR status', () => {
    const wrapper = renderComponent({status: EventIdStatus.ERROR});
    const eventIdField = wrapper.find('Field');
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual(eventIdValue);
    expect(eventIdField.find('FieldError')).toHaveLength(1);
    const closeIcon = eventIdField.find('CloseIcon');
    expect(closeIcon).toHaveLength(1);
    expect(closeIcon.find('Tooltip').prop('title')).toEqual('Clear event ID');
    const fieldErrorReason = eventIdField.find('FieldErrorReason');
    expect(fieldErrorReason).toHaveLength(1);
    expect(fieldErrorReason.text()).toEqual(
      'An error occurred while fetching the suggestions based on this event ID.'
    );
  });

  it('INVALID status', () => {
    const wrapper = renderComponent({status: EventIdStatus.INVALID});
    const eventIdField = wrapper.find('Field');
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual(eventIdValue);
    expect(eventIdField.find('FieldError')).toHaveLength(1);
    expect(eventIdField.find('CloseIcon')).toHaveLength(1);
    const fieldErrorReason = eventIdField.find('FieldErrorReason');
    expect(fieldErrorReason).toHaveLength(1);
    expect(fieldErrorReason.text()).toEqual('This event ID is invalid.');
  });

  it('NOTFOUND status', () => {
    const wrapper = renderComponent({status: EventIdStatus.NOT_FOUND});
    const eventIdField = wrapper.find('Field');
    const eventIdFieldInput = eventIdField.find('input');
    expect(eventIdFieldInput.prop('value')).toEqual(eventIdValue);
    expect(eventIdField.find('FieldError')).toHaveLength(1);
    expect(eventIdField.find('CloseIcon')).toHaveLength(1);
    const fieldErrorReason = eventIdField.find('FieldErrorReason');
    expect(fieldErrorReason).toHaveLength(1);
    expect(fieldErrorReason.text()).toEqual(
      'The chosen event ID was not found in projects you have access to.'
    );
  });
});
