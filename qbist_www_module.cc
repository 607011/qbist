/*
Original code by Jörn Loviscach <j.loviscach@computer.org>
Port to C++ and further modifications by Oliver Lau <oliver@von-und-fuer-lau.de>
$Id$
*/

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "qbist_www.h"

class QbistWwwModule : public pp::Module {
public:
	QbistWwwModule() : pp::Module() {}
	virtual ~QbistWwwModule() {}
	virtual pp::Instance* CreateInstance(PP_Instance instance) {
		return new QbistWwwInstance(instance);
	}
};

namespace pp {
	Module* CreateModule() {
		return new QbistWwwModule();
	}
}
