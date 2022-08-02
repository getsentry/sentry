import isObject from 'lodash/isObject';

import {KeyValueListData} from 'sentry/types';

import AnnotatedText from '../meta/annotatedText';

import getEventExtraDataKnownDataDetails from './getEventExtraDataKnownDataDetails';
import {EventExtraData, EventExtraDataType} from './types';

export function getEventExtraDataKnownData(
  data: EventExtraData,
  meta: Record<any, any> | undefined
): KeyValueListData {
  const knownData: KeyValueListData = [];

  const dataKeys = Object.keys(data);
  for (const key of Object.keys(data)) {
    const {subject, value} = getEventExtraDataKnownDataDetails(
      data,
      key as EventExtraDataType
    );

    if (Array.isArray(value)) {
      knownData.push({
        key,
        subject,
        value: value.map((v, index) =>
          meta?.[key]?.[index]?.[''] ? (
            <AnnotatedText key={index} value={v} meta={meta?.[key]?.[index]?.['']} />
          ) : (
            v
          )
        ),
      });
      continue;
    }

    if (isObject(value)) {
      knownData.push({
        key,
        subject,
        value: Object.keys(value).map((v, index) =>
          meta?.[key]?.[index]?.[''] ? (
            <AnnotatedText
              key={index}
              value={value[v]}
              meta={meta?.[key]?.[index]?.['']}
            />
          ) : (
            value[v]
          )
        ),
      });
    }

    knownData.push({
      key,
      subject,
      value,
      meta: meta?.[key]?.[''],
    });
  }

  return knownData;
}
