from __future__ import absolute_import

import pytest

from sentry.stacktraces.functions import (
    replace_enclosed_string,
    split_func_tokens,
    trim_function_name,
)


@pytest.mark.parametrize(
    "input,output",
    [
        [
            "Scaleform::GFx::AS3::IMEManager::DispatchEvent(char const *,char const *,char const *)",
            "Scaleform::GFx::AS3::IMEManager::DispatchEvent",
        ],
        [
            "static unsigned int Scaleform::GFx::AS3::IMEManager::DispatchEvent(char const *,char const *,char const *) const",
            "Scaleform::GFx::AS3::IMEManager::DispatchEvent",
        ],
        [
            "Scaleform::GFx::IME::GImeNamesManagerVista::OnActivated(unsigned long,unsigned short,_GUID const &,_GUID const &,_GUID const &,HKL__ *,unsigned long)",
            "Scaleform::GFx::IME::GImeNamesManagerVista::OnActivated",
        ],
        [
            "<actix_web::pipeline::Pipeline<S, H> as actix_web::server::handler::HttpHandlerTask>::poll_io",
            "actix_web::pipeline::Pipeline<T>::poll_io",
        ],
        ["+[FLFoo barBaz]", "+[FLFoo barBaz]"],
        ["-[FLFoo barBaz]", "-[FLFoo barBaz]"],
        [
            "<tokio_current_thread::scheduler::Scheduled<'a, U>>::tick",
            "tokio_current_thread::scheduler::Scheduled<T>::tick",
        ],
        [
            "tokio::runtime::current_thread::runtime::Runtime::enter::{{closure}}::{{closure}}::{{closure}}::{{closure}}",
            "tokio::runtime::current_thread::runtime::Runtime::enter::{{closure}}::{{closure}}::{{closure}}::{{closure}}",
        ],
        [
            "<std::panic::AssertUnwindSafe<F> as core::ops::function::FnOnce<()>>::call_once",
            "std::panic::AssertUnwindSafe<T>::call_once",
        ],
        [
            "struct style::gecko_bindings::sugar::ownership::Strong<style::gecko_bindings::structs::root::RawServoStyleSheetContents> geckoservo::glue::Servo_StyleSheet_Empty(style::gecko_bindings::structs::root::mozilla::css::SheetParsingMode) const",
            "geckoservo::glue::Servo_StyleSheet_Empty",
        ],
        [
            "static <NoType> std::panicking::begin_panic<str*>(struct str*, struct (str*, u32, u32) *)",
            "std::panicking::begin_panic<T>",
        ],
        [
            "(anonymous namespace)::StupidFunction<std::vector<std::string>>(int)",
            "(anonymous namespace)::StupidFunction<T>",
        ],
        ["static unsigned int _foo_function (uint32_t,uint32_t) const", "_foo_function"],
        [
            "v8::internal::operator<<(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)",
            "v8::internal::operator<<",
        ],
        [
            "unsigned int (anonymous namespace)::operator<<(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)",
            "(anonymous namespace)::operator<<",
        ],
        [
            "unsigned int mynamespace::MyClass::operator()(std::__1::basic_ostream<char, std::__1::char_traits<char> >&, v8::internal::MaybeObjectBrief const&)",
            "mynamespace::MyClass::operator()",
        ],
        [
            "std::basic_ostream<char, std::char_traits<char> >& std::operator<< <std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char)",
            "std::operator<< <T>",
        ],
        [
            "<actix::contextimpl::ContextFut<A, C> as futures::future::Future>::poll::h9de5fbebc1652d47",
            "actix::contextimpl::ContextFut<T>::poll",
        ],
        ["<T as core::convert::Into<U>>::into", "core::convert::Into<T>::into"],
        ["ThreadStartWhatever@16", "ThreadStartWhatever"],
        ["@ThreadStartWhatever@16", "ThreadStartWhatever"],
        ["@objc ViewController.causeCrash(Any) -> ()", "ViewController.causeCrash"],
        ["ViewController.causeCrash(Any) -> ()", "ViewController.causeCrash"],
        [
            "@objc ViewController.causeCrash(Any, Foo -> Bar) -> SomeObject",
            "ViewController.causeCrash",
        ],
        ["ViewController.causeCrash(Any) -> SomeObject", "ViewController.causeCrash"],
        ["main::$_0", "main::lambda"],
        ["main::$_42", "main::lambda"],
        ["main::{lambda(int)#1}", "main::lambda"],
        ["main::{lambda()#42}", "main::lambda"],
        ["lambda_7156c3ceaa11256748687ab67e3ef4cd", "lambda"],
        ["<lambda_7156c3ceaa11256748687ab67e3ef4cd>::operator()", "<lambda>::operator()"],
    ],
)
def test_trim_native_function_name(input, output):
    assert trim_function_name(input, "native") == output


@pytest.mark.parametrize(
    "input,output",
    [
        ["UnityEngine.Events.InvokableCall.Invoke ()", "UnityEngine.Events.InvokableCall.Invoke"],
        [
            "UnityEngine.EventSystems.ExecuteEvents.Execute[T] (UnityEngine.GameObject target, UnityEngine.EventSystems.BaseEventData eventData, UnityEngine.EventSystems.ExecuteEvents+EventFunction`1[T1] functor)",
            "UnityEngine.EventSystems.ExecuteEvents.Execute[T]",
        ],
    ],
)
def test_trim_csharp_function_name(input, output):
    assert trim_function_name(input, "csharp") == output


def replace_group(value, start):
    if start == 0:
        assert value == "anonymous namespace"
        return "(new value)"
    return "()"


@pytest.mark.parametrize(
    "input,start,end,replacement,output",
    [
        ["foo::bar<Blah, Blah<Blah, Blah>>", "<", ">", "<T>", "foo::bar<T>"],
        ["foo::bar(unsigned int, int)", "(", ")", "", "foo::bar"],
        [
            "(anonymous namespace)::foo::bar(unsigned int, int)",
            "(",
            ")",
            replace_group,
            "(new value)::foo::bar()",
        ],
    ],
)
def test_enclosed_string_simple(input, start, end, replacement, output):
    assert replace_enclosed_string(input, start, end, replacement) == output


@pytest.mark.parametrize(
    "input,output",
    [
        ["foo bar baz", ["foo", "bar", "baz"]],
        ["foo bar (enclosed baz)", ["foo", "bar", "(enclosed baz)"]],
        ["foo (enclosed bar) baz", ["foo", "(enclosed bar)", "baz"]],
        ["foo(enclosed bar)baz {moar stuff}", ["foo(enclosed bar)baz", "{moar stuff}"]],
        ["foo bar [baz (blah)]", ["foo", "bar", "[baz (blah)]"]],
    ],
)
def test_split_func_tokens(input, output):
    assert split_func_tokens(input) == output


def test_trim_function_name_cocoa():
    assert trim_function_name("+[foo:(bar)]", "objc") == "+[foo:(bar)]"
    assert trim_function_name("[foo:(bar)]", "objc") == "[foo:(bar)]"
    assert trim_function_name("-[foo:(bar)]", "objc") == "-[foo:(bar)]"
    assert (
        trim_function_name("(anonymous namespace)::foo(int)", "native")
        == "(anonymous namespace)::foo"
    )
    assert trim_function_name("foo::bar::foo(int)", "native") == "foo::bar::foo"
