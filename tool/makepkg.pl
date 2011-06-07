#!/usr/bin/env perl

use 5.010001;
use strict;
use warnings;

use Getopt::Std qw( getopts );
use JSON::XS ();
use File::Basename qw( dirname );

my %opts;
getopts('po:', \%opts);

my $outfile = ($opts{o} or 'makefile.jsmodule');
my $pkgfilepat = ($opts{p} or 'pkg.def');

my $json_xs = JSON::XS->new;

open my $out, ">$outfile" or
    die "Cannot open $outfile for writing: $!\n";

{
    print $out ".PHONY: all js\n\n";
    print $out "all: js\n\n";

    my @files = split /\n/, `find . -name '$pkgfilepat'`;
    #push @files, split /\n/, `find template/script -name '*.php.tt'`;

    #print "file count: ", scalar(@files), "\n";
    #print join " ", map { "[$_]" } @files;

    unless (@files) {
        say "no pkg defined file found";
        exit -1;
    }

    my @rules;
    my @cfgfiles;
    my @genfiles;
    for my $cfgfile (@files) {
        my $jsmap = read_json($cfgfile);
        my $basedir = dirname($cfgfile);
        $basedir .= '/';
        #warn $basedir;

        my @targets;
        while (my ($target, $modules) = each(%$jsmap)) {
            $target = $basedir . mname2path($target);
            push @targets, $target;
            my @list2;
            my $targetdir = dirname($target);

            for my $m (@$modules) {
                $m = $basedir . mname2path($m);

                my $jsfe = $m . ".embed";
                push @list2, $jsfe;
                push @genfiles, $jsfe;
            }

            push @genfiles, $target;
            print $out <<"_EOC_";
$target: @list2
\tmkdir -p $targetdir
\tcat \$^ >\$@

_EOC_
        }

        print $out "$cfgfile: @targets\n\n";
        push @cfgfiles, $cfgfile;
    }

    print $out join("\n", @rules), "\n";

    print $out "js: @cfgfiles\n\n";
    print $out "%.js.embed: %.js\n\tloader-embed \$< 2>/dev/null >\$@\n\n";
    print $out <<"_EOC_";
clean:
\trm -f @genfiles

_EOC_
}

close $out;

say "now, you can run: \nmake -f $outfile";

sub mname2path {
    my $m = shift;

    $m =~ s/\./\//g;
    $m .= '.js';

    return $m;
}

sub read_json {
    my $file = shift;
    open my $in, $file or
        die "Cannot open config file $file for reading: $!\n";

    my $json = do { local $/; <$in> };

    close $in;

    my $config = $json_xs->decode($json);
    return $config;
}

