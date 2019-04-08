from __future__ import absolute_import

import pytest

from sentry.grouping.strategies.stacktrace import isolate_native_function_v1
from sentry.grouping.strategies.utils import replace_enclosed_string, split_func_tokens


@pytest.mark.parametrize(
    'input,output',
    [
        [
            'Scaleform::GFx::AS3::IMEManager::DispatchEvent(char const *,char const *,char const *)',
            'Scaleform::GFx::AS3::IMEManager::DispatchEvent',
        ],
        [
            'static unsigned int Scaleform::GFx::AS3::IMEManager::DispatchEvent(char const *,char const *,char const *) const',
            'Scaleform::GFx::AS3::IMEManager::DispatchEvent',
        ],
        [
            'Scaleform::GFx::IME::GImeNamesManagerVista::OnActivated(unsigned long,unsigned short,_GUID const &,_GUID const &,_GUID const &,HKL__ *,unsigned long)',
            'Scaleform::GFx::IME::GImeNamesManagerVista::OnActivated',
        ],
        [
            '<actix_web::pipeline::Pipeline<S, H> as actix_web::server::handler::HttpHandlerTask>::poll_io',
            '<actix_web::pipeline::Pipeline<T> as actix_web::server::handler::HttpHandlerTask>::poll_io',
        ],
        [
            '+[FLFoo barBaz]',
            '+[FLFoo barBaz]',
        ],
        [
            '-[FLFoo barBaz]',
            '-[FLFoo barBaz]',
        ],
        [
            '<tokio_current_thread::scheduler::Scheduled<\'a, U>>::tick',
            '<tokio_current_thread::scheduler::Scheduled<T>>::tick',
        ],
        [
            'tokio::runtime::current_thread::runtime::Runtime::enter::{{closure}}::{{closure}}::{{closure}}::{{closure}}',
            'tokio::runtime::current_thread::runtime::Runtime::enter::{{closure}}::{{closure}}::{{closure}}::{{closure}}',
        ],
        [
            '<std::panic::AssertUnwindSafe<F> as core::ops::function::FnOnce<()>>::call_once',
            '<std::panic::AssertUnwindSafe<T> as core::ops::function::FnOnce<T>>::call_once',
        ],
        [
            'struct style::gecko_bindings::sugar::ownership::Strong<style::gecko_bindings::structs::root::RawServoStyleSheetContents> geckoservo::glue::Servo_StyleSheet_Empty(style::gecko_bindings::structs::root::mozilla::css::SheetParsingMode) const',
            'geckoservo::glue::Servo_StyleSheet_Empty',
        ],
        [
            'static <NoType> std::panicking::begin_panic<str*>(struct str*, struct (str*, u32, u32) *)',
            'std::panicking::begin_panic<T>',
        ],
        [
            '(anonymous namespace)::StupidFunction<std::vector<std::string>>(int)',
            '(anonymous namespace)::StupidFunction<T>',
        ],
        [
            'static unsigned int _foo_function (uint32_t,uint32_t) const',
            '_foo_function',
        ],
        [
            'v8::internal::operator<<(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)',
            'v8::internal::operator<<',
        ],
        [
            'unsigned int (anonymous namespace)::operator<<(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)',
            '(anonymous namespace)::operator<<',
        ],
        [
            'unsigned int mynamespace::MyClass::operator()(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)',
            'mynamespace::MyClass::operator()',
        ],
    ]
)
def test_isolate_native_function_v1(input, output):
    assert isolate_native_function_v1(input) == output


def replace_group(value, start):
    if start == 0:
        assert value == 'anonymous namespace'
        return '(new value)'
    return '()'


@pytest.mark.parametrize(
    'input,start,end,replacement,output',
    [
        ['foo::bar<Blah, Blah<Blah, Blah>>', '<', '>', '<T>', 'foo::bar<T>'],
        ['foo::bar(unsigned int, int)', '(', ')', '', 'foo::bar'],
        ['(anonymous namespace)::foo::bar(unsigned int, int)', '(', ')',
         replace_group, '(new value)::foo::bar()'],
    ]
)
def test_enclosed_string_simple(input, start, end, replacement, output):
    assert replace_enclosed_string(input, start, end, replacement) == output


@pytest.mark.parametrize(
    'input,output',
    [
        ['foo bar baz', ['foo', 'bar', 'baz']],
        ['foo bar (enclosed baz)', ['foo', 'bar', '(enclosed baz)']],
        ['foo (enclosed bar) baz', ['foo', '(enclosed bar)', 'baz']],
        ['foo(enclosed bar)baz {moar stuff}', ['foo(enclosed bar)baz', '{moar stuff}']],
        ['foo bar [baz (blah)]', ['foo', 'bar', '[baz (blah)]']],
    ]
)
def test_split_func_tokens(input, output):
    assert split_func_tokens(input) == output
