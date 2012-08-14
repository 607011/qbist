/*
Copyright (c) 2012 Oliver Lau <oliver@von-und-fuer-lau.de>
All rights reserved.
$Id: qbist_www_handlemessage.cc 87d3392f8cbf 2012/02/24 14:30:29 Oliver Lau <oliver@von-und-fuer-lau.de> $
*/

#include <iostream>
#include <string>
#include <sstream>
#include <boost/property_tree/ptree.hpp>
#include <boost/property_tree/json_parser.hpp>
#include <boost/foreach.hpp>
#include "qbist_www.h"
#include "colorspace.h"


// TODO: auf eindimensionale Matrix umstellen
void readArray(boost::property_tree::ptree& pt, std::vector<int>& m, const char* fieldName) {
	m.clear();
	BOOST_FOREACH(boost::property_tree::ptree::value_type &el, pt.get_child(fieldName)) {
		m.push_back(::atoi(el.second.data().c_str()));
	}
}


void QbistWwwInstance::HandleMessage(const pp::Var& var_message) {
	if (!var_message.is_string())
		return;
	std::string param = var_message.AsString();
	boost::property_tree::ptree pt;
	std::stringstream param_stream(param, std::stringstream::in);
	boost::property_tree::read_json(param_stream, pt);
	std::string command = pt.get<std::string>("command");
	if (command == "paint") {
		mVariation = pt.get<int>("variation");
		mRegCount = pt.get<int>("NUM_REGISTERS");
		// mOverlayMethod  = pt.get<int>("overlayMethod");
		setNumThreads(pt.get<int>("threadcount"));
		readArray(pt, mTransform, "transform");
		readArray(pt, mSource, "source");
		readArray(pt, mControl, "control");
		readArray(pt, mDest, "dest");
		Optimize();
		Draw();
		FlushPixelBuffer();
		std::stringstream reply;
		reply << "{"
			<< " \"message\": \"painted\"," 
			<< " \"variation\": " << mVariation
			<< "}";
		PostMessage(pp::Var(reply.str()));
	}
	else {
		PostMessage(pp::Var("invalid command"));
	}
}
