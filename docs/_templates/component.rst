Component
---------
Component documents are meant to sit in the root of a directory in ``src/sentry/``, named
``README.rst``, and act as a guide to what the component is for. Below is an annotated
example of a component named ``toaster``.

#####

Toaster
-------
**# Two sentence intro. What it is and what it’s used for.**

The toaster is a metal apparatus that heats things inside of it.
The toaster is responsible for turning bread into toast.

Purpose
=======
**# Why does your component exist and anything you’d like to state about it.**

The toaster is the easiest way to make crispy toast out of bread.
It does not take up any electricity while idle, and the crispiness can be customized
during each toasting process.

Owners
======
**# What team to probably mention if you change something in the component.**

@getsentry/breakfast

Dependencies
============
**# Links to other component docs and a small blurb on why your component depends on them.**

=========== =================================
Component   Interaction
----------- ---------------------------------
Electricity Without energy there is no toast.
=========== =================================

Design
======
**# A summary of how the component is designed to operate. Bonus points for ASCII diagrams.**

A toaster is meant to apply heat on either side of bread.
It comes with a timer so that it does not eventually burn the bread.
Some toasters can come with sensors to predict the optimal toasting point of bread.

Implementations (Optional)
==========================
**# The different ways that the design is implemented, starting with the recommended.
This is meant for the components that are implemented via different technology
(Rabbit vs. Redis)**

Single Unit
~~~~~~~~~~~
The single unit is a compact toaster whose responsibility is solely toasting.
It is a cheap unit, it does its job, and it is easy to replace in the event of a failure.

Toaster Oven
~~~~~~~~~~~~
The oven implementation will allow you to do more things than just toast bread,
but since we only toast bread, it is too expensive.

Interaction
===========
**# Basic instructions and caveats for having other components interact with yours.**

When attempting to toast from the Internet, you have the ability to omit ``start_time``
for the toaster to start immediately. If you supply a ``finish_time``  of over an hour,
the toaster will throw a ``TooToasty`` exception.

If you plan to inherit the ``Toast`` class, make sure that you super the ``make()`` method
first so that your bread gets toasted first. IE: ``AvocadoToast`` would call
``apply_avocado_spread()`` in ``make()``, only after it has supered the method.

Developmental Cycle
===================
**# Recommended practices in order to successfully land your changes.**

When building a new toaster, you should start with making sure your electricity is running.
That way you can see if your toaster properly heats up. This can be done by running
``pge start`` in the background.

Testing
=======
**# Anything you’d like to suggest before submitting a PR or about writing tests.**

When writing tests for your toaster, it is best to not only test that is successfully
toasts bread, but that it has no ability to set the things around it on fire.
