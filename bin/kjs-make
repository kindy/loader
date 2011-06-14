#!/usr/bin/env perl

use 5.010001;
use strict;
use warnings;

use Getopt::Std qw( getopt getopts );
use JSON::XS ();
use File::Basename qw( dirname );
use File::Temp qw/ tmpnam /;
#use File::Find qw/ find /;
use File::Copy;

my %opts;
getopt('sdpoEMm', \%opts);

my $outfile = ($opts{o} or 'makefile.js');
my $pkgfilepat = ($opts{p} or 'pkg.def');
my $dir_src = ($opts{s} or 'src');
my $dir_dist = ($opts{d} or 'dist');
my $embed_bin = ($opts{E} or 'embed');
my $jsm_bin = ($opts{M} or 'uglifyjs');

$dir_src =~ s@/+$@@;
$dir_dist =~ s@/+$@@;

#warn $dir_src;
#warn $pkgfilepat;
my $json_xs = JSON::XS->new;

my $outfile_tmp = tmpnam();
#warn $outfile_tmp;

open my $out, ">$outfile_tmp" or
    die "Cannot open $outfile for writing: $!\n";

=c
.PHONY: embed pkg min

-- A find src -name '*.js'
embed: dist/embed/*.js

-- B
pkg: dist/embed/pkg/*.js

-- B
dist/embed/pkg/*.js: dist/embed/*.js
    cat xx

-- A + B
min: dist/min/*.js


=cut

{
    print $out <<"_EOC_";
.PHONY: all embed pkg min clean

all: min

$dir_dist/embed/%.js: $dir_src/%.js
\tmkdir -p \$\$(dirname \$@)
\t$embed_bin \$< >\$\@

$dir_dist/min/%.js: $dir_dist/embed/%.js
\tmkdir -p \$\$(dirname \$@)
\t$jsm_bin \$< >\$\@

clean:
\trm -rf $dir_dist

_EOC_

    my @modules;
    my @pkgdefs;

    @modules = split /\n/, `find $dir_src -name '*.js' -printf '%P\\n'`;
    #print join "\n", @modules;
    #warn "find $dir_src -name '*.js'";

    my @modules_path;
    for my $module (@modules) {
        push @modules_path, "$dir_dist/embed/$module";
    }
    print $out "embed: @modules_path\n\n";

    @pkgdefs = split /\n/, `find $dir_src -name '$pkgfilepat' -printf '%p\\t%P\\n'`;

    #warn "find $dir_src -name '$pkgfilepat' -printf '%p\\t%P\\n'";
    #warn "xx @pkgdefs";

    #close $out;
    #copy($outfile_tmp, $outfile) or die "Copy failed: $!";
    #exit -1;

    #print "file count: ", scalar(@files), "\n";
    #print join " ", map { "[$_]" } @files;

    if (@pkgdefs) {

        my @all_pkgdef;

        for my $pkgdef (@pkgdefs) {
            my $pkgdef_file;
            ($pkgdef_file, $pkgdef) = split /\t/, $pkgdef;

            my $pkgmap = read_json($pkgdef_file);

            my @pkgdef_pkgs;
            while (my ($target, $modules) = each(%$pkgmap)) {
                $target = mname2path($target);

                push @modules, $target;

                $target = "$dir_dist/embed/$target";

                push @pkgdef_pkgs, $target;

                my @pkg_mods;

                for my $m (@$modules) {
                    $m = mname2path($m);

                    push @pkg_mods, "$dir_dist/embed/$m";
                }

                print $out <<"_EOC_";
$target: @pkg_mods
\tmkdir -p \$\$(dirname \$@)
\tcat \$^ >\$@

_EOC_
            }

            push @all_pkgdef, "$dir_src/$pkgdef";
            print $out "$dir_src/$pkgdef: @pkgdef_pkgs\n\n";
        }

        print $out "pkg: @all_pkgdef\n\n";
    }

    @modules_path = ();
    for my $module (@modules) {
        push @modules_path, "$dir_dist/min/$module";
    }
    print $out "min: @modules_path\n\n";
}

close $out;
copy($outfile_tmp, $outfile) or die "Copy failed: $!";

{
    my $mk = "make -f $outfile";
    say "now, you can run:";
    say "\t$mk embed - embed all module";
    say "\t$mk pkg - make all pkg";
    say "\t$mk min - minify all module";
}

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

